import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { getGitHubPrivateKey } from "@/lib/github-app-key";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import { taskEventData } from "@/lib/task-events";

export const runtime = "nodejs";

const schema = z.object({
  agentId: z.string().min(1),
  summary: z.string().min(1).max(500),
  changes: z.array(
    z.object({
      path: z.string().min(1).max(500),
      content: z.string().max(256 * 1024)
    })
  ).min(1).max(20)
});

async function createAppJwt() {
  const appId =
    process.env.GITHUB_APP_ID;

  if (!appId) {
    throw new Error(
      "Missing GitHub App configuration"
    );
  }

  const pem =
    getGitHubPrivateKey();

  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(key);
}

async function githubFetch(
  url: string,
  token: string,
  options: RequestInit = {}
) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
      ...(options.headers || {})
    }
  });
}

async function getInstallationToken(owner: string, repo: string) {
  const jwt = await createAppJwt();

  const installationRes = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    jwt
  );

  if (!installationRes.ok) {
    throw new Error(
      `Installation lookup failed: ${installationRes.status}`
    );
  }

  const installation = await installationRes.json();

  const tokenRes = await githubFetch(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    jwt,
    { method: "POST" }
  );

  if (!tokenRes.ok) {
    throw new Error(
      `Token creation failed: ${tokenRes.status}`
    );
  }

  const tokenData = await tokenRes.json();
  return tokenData.token as string;
}

function validatePath(path: string) {
  if (
    path.includes("..") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path === ".git" ||
    path.startsWith(".git/")
  ) {
    throw new Error(`Unsafe file path: ${path}`);
  }

  // Agents cannot alter CI verification logic.
  if (
    path === ".github/workflows" ||
    path.startsWith(".github/workflows/")
  ) {
    throw new Error("Agents cannot modify GitHub workflows");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = schema.parse(await request.json());

    const authorized =
      await verifyAgentToken(
        request,
        data.agentId
      );

    if (!authorized) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const task = await db.task.findUnique({
      where: { id }
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (task.assignedAgentId !== data.agentId) {
      return NextResponse.json(
        { error: "not_assigned_to_agent" },
        { status: 403 }
      );
    }

    if (
      task.workType !== "CODE" ||
      task.deliveryType !== "PULL_REQUEST"
    ) {
      return NextResponse.json(
        {
          error: "coding_pull_request_delivery_required"
        },
        { status: 409 }
      );
    }

    if (!["ASSIGNED", "WORKING", "REVISION"].includes(task.status)) {
      return NextResponse.json(
        {
          error: "task_not_changeable",
          status: task.status
        },
        { status: 409 }
      );
    }

    if (!task.githubRepo) {
      return NextResponse.json(
        { error: "github_repo_missing" },
        { status: 400 }
      );
    }

    for (const change of data.changes) {
      validatePath(change.path);
    }

    const totalBytes = data.changes.reduce(
      (total, change) =>
        total + Buffer.byteLength(change.content, "utf8"),
      0
    );

    if (totalBytes > 1024 * 1024) {
      return NextResponse.json(
        {
          error: "changes_too_large",
          maxBytes: 1024 * 1024
        },
        { status: 413 }
      );
    }

    const [owner, repo] = task.githubRepo.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "invalid_repository" },
        { status: 400 }
      );
    }

    await db.task.update({
      where: { id },
      data: { status: "WORKING" }
    });

    const token = await getInstallationToken(owner, repo);

    // Find default branch.
    const repoRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      token
    );

    if (!repoRes.ok) {
      throw new Error(
        `Repository lookup failed: ${repoRes.status}`
      );
    }

    const repoData = await repoRes.json();
    const baseBranch = repoData.default_branch;

    // Find base commit.
    const refRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
      token
    );

    if (!refRes.ok) {
      throw new Error(
        `Base branch lookup failed: ${refRes.status}`
      );
    }

    const baseRef = await refRes.json();

    // Create a dedicated task branch.
    const branch =
      `agentbounty/task-${id.slice(-6)}-` +
      Date.now().toString().slice(-6);

    const createBranchRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: baseRef.object.sha
        })
      }
    );

    if (!createBranchRes.ok) {
      throw new Error(
        `Branch creation failed: ${createBranchRes.status} ${await createBranchRes.text()}`
      );
    }

    const committedFiles: string[] = [];

    for (const change of data.changes) {
      // Look up existing file SHA on the new branch.
      const encodedPath = change.path
        .split("/")
        .map(encodeURIComponent)
        .join("/");

      const existingRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
        token
      );

      let sha: string | undefined;

      if (existingRes.ok) {
        const existing = await existingRes.json();

        if (existing.type !== "file") {
          throw new Error(
            `${change.path} is not a regular file`
          );
        }

        sha = existing.sha;
      } else if (existingRes.status !== 404) {
        throw new Error(
          `File lookup failed for ${change.path}: ${existingRes.status}`
        );
      }

      const updateRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
        token,
        {
          method: "PUT",
          body: JSON.stringify({
            message: `AgentBounty: ${task.title}`,
            content: Buffer
              .from(change.content, "utf8")
              .toString("base64"),
            branch,
            ...(sha ? { sha } : {})
          })
        }
      );

      if (!updateRes.ok) {
        throw new Error(
          `Commit failed for ${change.path}: ${updateRes.status} ${await updateRes.text()}`
        );
      }

      committedFiles.push(change.path);
    }

    // Create PR.
    const prRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          title: `AgentBounty: ${task.title}`,
          head: branch,
          base: baseBranch,
          body:
            `Automated AgentBounty delivery.\n\n` +
            `Agent summary: ${data.summary}\n\n` +
            (task.githubIssueUrl
              ? `Related issue: ${task.githubIssueUrl}\n`
              : "")
        })
      }
    );

    if (!prRes.ok) {
      throw new Error(
        `Pull request creation failed: ${prRes.status} ${await prRes.text()}`
      );
    }

    const pr = await prRes.json();

    const submission = await db.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          taskId: task.id,
          agentId: data.agentId,
          deliveryType: "PULL_REQUEST",
          pullRequestUrl: pr.html_url,
          notes:
            `${data.summary}\nChanged files: ` +
            committedFiles.join(", ")
        }
      });

      await tx.task.update({
        where: { id: task.id },
        data: { status: "SUBMITTED" }
      });

      await tx.taskEvent.create({
        data:
          taskEventData({
            taskId:
              task.id,

            type:
              "DELIVERY_SUBMITTED",

            actorType:
              "AGENT",

            actorId:
              data.agentId,

            message:
              "Pull request submitted",

            metadata: {
              submissionId:
                created.id,

              pullRequestUrl:
                pr.html_url,

              branch,

              changedFiles:
                committedFiles,
            },

            dedupeKey:
              `submission:${created.id}:submitted`,
          }),
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      taskId: task.id,
      repository: task.githubRepo,
      branch,
      changedFiles: committedFiles,
      pullRequest: pr.html_url,
      submissionId: submission.id,
      status: "SUBMITTED"
    });

  } catch (e) {
    console.error(e);
    return apiError(e);
  }
}
