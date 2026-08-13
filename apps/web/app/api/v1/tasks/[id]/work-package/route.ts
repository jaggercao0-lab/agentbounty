import { NextResponse } from "next/server";
import fs from "fs";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import { taskEventData } from "@/lib/task-events";

export const runtime = "nodejs";

async function createAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;

  if (!appId || !privateKeyPath) {
    throw new Error("Missing GitHub App configuration");
  }

  const pem = fs.readFileSync(privateKeyPath, "utf8");
  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(key);
}

async function getInstallationToken(owner: string, repo: string) {
  const jwt = await createAppJwt();

  const installationRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      }
    }
  );

  if (!installationRes.ok) {
    throw new Error(
      `Installation lookup failed: ${installationRes.status}`
    );
  }

  const installation = await installationRes.json();

  const tokenRes = await fetch(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      }
    }
  );

  if (!tokenRes.ok) {
    throw new Error(
      `Token creation failed: ${tokenRes.status}`
    );
  }

  const tokenData = await tokenRes.json();
  return tokenData.token as string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "agent_id_required" },
        { status: 400 }
      );
    }

    const authorized =
      await verifyAgentToken(
        request,
        agentId
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

    if (task.assignedAgentId !== agentId) {
      return NextResponse.json(
        { error: "not_assigned_to_agent" },
        { status: 403 }
      );
    }

    if (!task.githubRepo) {
      return NextResponse.json(
        { error: "github_repo_missing" },
        { status: 400 }
      );
    }

    const [owner, repo] = task.githubRepo.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "invalid_repository" },
        { status: 400 }
      );
    }

    const token = await getInstallationToken(owner, repo);

    // Repository information
    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10"
        }
      }
    );

    if (!repoRes.ok) {
      throw new Error(
        `Repository lookup failed: ${repoRes.status}`
      );
    }

    const repoData = await repoRes.json();

    // Get repository tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(repoData.default_branch)}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10"
        }
      }
    );

    if (!treeRes.ok) {
      throw new Error(
        `Repository tree lookup failed: ${treeRes.status}`
      );
    }

    const treeData = await treeRes.json();

    const files = (treeData.tree || [])
      .filter((item: any) => item.type === "blob")
      .slice(0, 500)
      .map((item: any) => ({
        path: item.path,
        size: item.size
      }));

    // Read original GitHub Issue
    let githubIssue = null;

    if (task.githubIssueUrl) {
      const issueMatch =
        task.githubIssueUrl.match(/\/issues\/(\d+)$/);

      if (issueMatch) {
        const issueNumber = Number(issueMatch[1]);

        const issueRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2026-03-10"
            }
          }
        );

        if (issueRes.ok) {
          const issue = await issueRes.json();

          githubIssue = {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            url: issue.html_url
          };
        }
      }
    }

    await db.taskEvent.upsert({
      where: {
        dedupeKey:
          `task:${task.id}:execution:${task.revisionCount}`,
      },

      update: {},

      create:
        taskEventData({
          taskId:
            task.id,

          type:
            "EXECUTION_STARTED",

          actorType:
            "AGENT",

          actorId:
            agentId,

          message:
            task.revisionCount > 0
              ? "Worker started revision execution"
              : "Worker started execution",

          metadata: {
            revisionCount:
              task.revisionCount,
          },

          dedupeKey:
            `task:${task.id}:execution:${task.revisionCount}`,
        }),
    });

    return NextResponse.json({
      protocolVersion: "0.3",

      task: {
        id: task.id,
        title: task.title,
        description: task.description,

        bountyCents: task.bountyCents,
        executionFeeCents: task.executionFeeCents,
        successRewardCents: task.successRewardCents,

        includedRevisions: task.includedRevisions,
        revisionCount: task.revisionCount,

        acceptanceCriteria:
          JSON.parse(task.acceptanceCriteriaJson)
      },

      repository: {
        fullName: task.githubRepo,
        owner,
        name: repo,
        defaultBranch: repoData.default_branch,
        private: repoData.private
      },

      issue: githubIssue,

      workspace: {
        files
      }
    });

  } catch (e) {
    console.error(e);
    return apiError(e);
  }
}
