import { NextResponse } from "next/server";
import fs from "fs";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "@agentbounty/database";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import { apiError } from "@/lib/http";

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
      "X-GitHub-Api-Version": "2026-03-10",
      ...(options.headers || {})
    }
  });
}

async function getToken(owner: string, repo: string) {
  const jwt = await createAppJwt();

  const installationRes = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    jwt
  );

  if (!installationRes.ok) {
    throw new Error("GitHub App installation not found");
  }

  const installation = await installationRes.json();

  const tokenRes = await githubFetch(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    jwt,
    { method: "POST" }
  );

  if (!tokenRes.ok) {
    throw new Error("Unable to create installation token");
  }

  const data = await tokenRes.json();
  return data.token as string;
}

async function readFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token: string
) {
  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const res = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
    token
  );

  if (!res.ok) return null;

  const file = await res.json();

  if (file.type !== "file") return null;

  return Buffer.from(
    (file.content || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user =
      await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }


    const { id } = await params;

    const task = await db.task.findFirst({
      where: {
        id,
        ownerId: user.id
      }
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (task.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "task_not_submitted", status: task.status },
        { status: 409 }
      );
    }

    const submission = await db.submission.findFirst({
      where: { taskId: id },
      orderBy: { createdAt: "desc" }
    });

    if (!submission?.pullRequestUrl || !task.githubRepo) {
      return NextResponse.json(
        { error: "submission_or_repository_missing" },
        { status: 400 }
      );
    }

    const [owner, repo] = task.githubRepo.split("/");

    const prMatch =
      submission.pullRequestUrl.match(/\/pull\/(\d+)$/);

    if (!prMatch) {
      return NextResponse.json(
        { error: "invalid_pull_request_url" },
        { status: 400 }
      );
    }

    const prNumber = Number(prMatch[1]);

    const token = await getToken(owner, repo);

    const prRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      token
    );

    if (!prRes.ok) {
      throw new Error(`PR lookup failed: ${prRes.status}`);
    }

    const pr = await prRes.json();

    const baseBranch = pr.base.ref;
    const headBranch = pr.head.ref;

    const criteria: string[] =
      JSON.parse(task.acceptanceCriteriaJson);

    const evidence: any[] = [];

    let passed = true;

    // Basic PR validation
    const repoCorrect =
      pr.base.repo.full_name === task.githubRepo;

    const prValid =
      pr.state === "open" &&
      !pr.draft &&
      repoCorrect;

    evidence.push({
      criterion: "Valid pull request",
      passed: prValid
    });

    if (!prValid) passed = false;

    for (const criterion of criteria) {
      let criterionPassed = true;
      let detail = "";

      if (
        criterion
          .toLowerCase()
          .startsWith("a pull request is submitted")
      ) {
        criterionPassed = prValid;
        detail = submission.pullRequestUrl;
      }

      else if (
        criterion.startsWith("README contains:")
      ) {
        const expected =
          criterion
            .slice("README contains:".length)
            .trim();

        const headReadme = await readFile(
          owner,
          repo,
          "README.md",
          headBranch,
          token
        );

        criterionPassed =
          !!headReadme &&
          headReadme.includes(expected);

        detail = expected;
      }

      else if (
        criterion.toLowerCase() ===
        "existing readme content is preserved"
      ) {
        const baseReadme = await readFile(
          owner,
          repo,
          "README.md",
          baseBranch,
          token
        );

        const headReadme = await readFile(
          owner,
          repo,
          "README.md",
          headBranch,
          token
        );

        if (!baseReadme || !headReadme) {
          criterionPassed = false;
        } else {
          const originalLines =
            baseReadme
              .split("\n")
              .map(line => line.trim())
              .filter(Boolean);

          criterionPassed =
            originalLines.every(line =>
              headReadme.includes(line)
            );
        }

        detail =
          "All non-empty README lines from base branch remain present";
      }

      else {
        // Unknown natural-language criteria are NOT silently accepted.
        criterionPassed = false;
        detail =
          "No deterministic verifier exists for this criterion";
      }

      evidence.push({
        criterion,
        passed: criterionPassed,
        detail
      });

      if (!criterionPassed) {
        passed = false;
      }
    }

    // Checks
    const checksRes = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`,
      token
    );

    let checkCount = 0;
    let checksPassed = true;
    let checksPending = false;

    if (checksRes.ok) {
      const data = await checksRes.json();
      const checks = data.check_runs || [];

      checkCount = checks.length;

      if (checks.length > 0) {
        checksPending = checks.some(
          (check: any) => check.status !== "completed"
        );

        if (!checksPending) {
          checksPassed = checks.every((check: any) =>
            ["success", "neutral", "skipped"]
              .includes(check.conclusion)
          );
        }
      }
    }

    if (checksPending) {
      evidence.push({
        criterion: "GitHub checks",
        passed: false,
        pending: true,
        detail: `${checkCount} checks still running`
      });

      return NextResponse.json({
        passed: null,
        pending: true,
        taskId: task.id,
        pullRequest: submission.pullRequestUrl,
        evidence,
        status: "SUBMITTED"
      });
    }

    if (!checksPassed) passed = false;

    evidence.push({
      criterion: "GitHub checks",
      passed: checksPassed,
      detail:
        checkCount === 0
          ? "No checks configured"
          : `${checkCount} completed checks evaluated`
    });

    const updated = await db.$transaction(
      async tx => {
        await tx.submission.update({
          where: { id: submission.id },
          data: {
            ciPassed: checksPassed,
            verifiedAt: new Date()
          }
        });

        if (passed) {
          return tx.task.update({
            where: { id },
            data: {
              status: "ACCEPTED"
            }
          });
        }

        return tx.task.update({
          where: { id },
          data: {
            status: "REVISION",
            revisionCount: {
              increment: 1
            }
          }
        });
      }
    );

    return NextResponse.json({
      passed,
      taskId: task.id,
      pullRequest: submission.pullRequestUrl,
      evidence,
      status: updated.status
    });

  } catch (e) {
    console.error(e);
    return apiError(e);
  }
}
