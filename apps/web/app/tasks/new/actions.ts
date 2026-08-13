"use server";

import fs from "fs";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "@agentbounty/database";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWebUser } from "@/lib/web-session";
import { taskEventData } from "@/lib/task-events";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function dollarsToCents(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }

  return Math.round(amount * 100);
}

function parseIssueUrl(url: string) {
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/
  );

  if (!match) {
    throw new Error("Invalid GitHub Issue URL");
  }

  return {
    owner: match[1],
    repo: match[2],
    issueNumber: Number(match[3]),
    fullName: `${match[1]}/${match[2]}`
  };
}

async function createAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath =
    process.env.GITHUB_PRIVATE_KEY_PATH;

  if (!appId || !privateKeyPath) {
    throw new Error(
      "GitHub App configuration is missing"
    );
  }

  const pem = fs.readFileSync(
    privateKeyPath,
    "utf8"
  );

  const key = await importPKCS8(
    pem,
    "RS256"
  );

  const now = Math.floor(
    Date.now() / 1000
  );

  return new SignJWT({})
    .setProtectedHeader({
      alg: "RS256"
    })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(key);
}

async function getInstallationToken(
  owner: string,
  repo: string
) {
  const jwt = await createAppJwt();

  const installationResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      },
      cache: "no-store"
    }
  );

  if (!installationResponse.ok) {
    throw new Error(
      "AgentBounty is not installed on this repository"
    );
  }

  const installation =
    await installationResponse.json();

  const tokenResponse = await fetch(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      },
      cache: "no-store"
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(
      "Unable to create GitHub installation token"
    );
  }

  const tokenData =
    await tokenResponse.json();

  return tokenData.token as string;
}

function buildSuggestedCriteria(
  repo: string,
  body: string
) {
  const criteria = [
    `A pull request is submitted to ${repo}`
  ];

  const lines = body
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const mentionsReadme =
    body.toLowerCase().includes("readme");

  if (mentionsReadme) {
    for (const line of lines) {

      // Markdown headings requested by issue.
      if (/^#{1,6}\s+.+/.test(line)) {
        criteria.push(
          `README contains: ${line}`
        );
        continue;
      }

      // Explicit bullet content.
      if (/^-\s+.+/.test(line)) {
        criteria.push(
          `README contains: ${line}`
        );
        continue;
      }

      // Preserve requirement.
      if (
        /preserve.*existing.*readme/i.test(line)
      ) {
        criteria.push(
          "Existing README content is preserved"
        );
        continue;
      }

      // Sentences that look like exact content
      // rather than instructions.
      const looksLikeInstruction =
        /^(add|change|update|remove|replace|create|please|the readme must)/i
          .test(line);

      if (
        !looksLikeInstruction &&
        line.length >= 12 &&
        line.length <= 180 &&
        /[.!?]$/.test(line)
      ) {
        criteria.push(
          `README contains: ${line}`
        );
      }
    }
  }

  return [...new Set(criteria)];
}

export async function previewGitHubIssue(
  issueUrl: string
) {
  try {
    const {
      owner,
      repo,
      issueNumber,
      fullName
    } = parseIssueUrl(issueUrl.trim());

    const token =
      await getInstallationToken(
        owner,
        repo
      );

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `GitHub Issue lookup failed (${response.status})`
      );
    }

    const issue = await response.json();

    if (issue.pull_request) {
      throw new Error(
        "This URL points to a Pull Request, not an Issue"
      );
    }

    const body =
      issue.body || "";

    return {
      ok: true as const,

      issue: {
        number: issue.number,
        title: issue.title,
        body,
        state: issue.state,
        url: issue.html_url
      },

      repository: {
        fullName
      },

      suggestedAcceptanceCriteria:
        buildSuggestedCriteria(
          fullName,
          body
        )
    };

  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Unable to import GitHub Issue"
    };
  }
}

export async function createTask(
  formData: FormData
) {
  
  const user = await requireWebUser();

const title =
    text(formData, "title");

  const description =
    text(formData, "description");

  const githubIssueUrl =
    text(formData, "githubIssueUrl");

  const {
    fullName: githubRepo
  } = parseIssueUrl(
    githubIssueUrl
  );

  const bountyCents =
    dollarsToCents(
      text(formData, "bounty")
    );

  const executionFeeCents =
    dollarsToCents(
      text(formData, "executionFee")
    );

  if (
    executionFeeCents >= bountyCents
  ) {
    throw new Error(
      "Execution fee must be smaller than bounty"
    );
  }

  const includedRevisions =
    Number(
      formData.get(
        "includedRevisions"
      ) || 1
    );

  const criteriaText =
    text(
      formData,
      "acceptanceCriteria"
    );

  const acceptanceCriteria =
    criteriaText
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  if (
    acceptanceCriteria.length === 0
  ) {
    throw new Error(
      "At least one acceptance criterion is required"
    );
  }

  const task = await db.task.create({
    data: {
      
    ownerId: user.id,
title,
      description,
      githubRepo,
      githubIssueUrl,

      bountyCents,
      executionFeeCents,

      successRewardCents:
        bountyCents -
        executionFeeCents,

      includedRevisions,

      acceptanceCriteriaJson:
        JSON.stringify(
          acceptanceCriteria
        ),

      status: "OPEN"
    }
  });

  await db.taskEvent.create({
    data:
      taskEventData({
        taskId:
          task.id,

        type:
          "CONTRACT_PUBLISHED",

        actorType:
          "HUMAN",

        actorId:
          user.id,

        message:
          "Contract published",

        metadata: {
          githubRepo,
          bountyCents,
          executionFeeCents,
          successRewardCents:
            bountyCents -
            executionFeeCents,
        },

        dedupeKey:
          `task:${task.id}:published`,
      }),
  });

  revalidatePath("/tasks");

  redirect(
    `/tasks/${task.id}`
  );
}
