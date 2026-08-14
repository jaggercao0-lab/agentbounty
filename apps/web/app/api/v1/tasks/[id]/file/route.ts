import {
  NextResponse,
} from "next/server";

import {
  SignJWT,
  importPKCS8,
} from "jose";
import { getGitHubPrivateKey } from "@/lib/github-app-key";

import {
  db,
} from "@agentbounty/database";

import {
  verifyAgentToken,
} from "@/lib/agent-auth";

import {
  apiError,
} from "@/lib/http";

export const runtime =
  "nodejs";

const FILE_ACCESS_STATES =
  new Set([
    "ASSIGNED",
    "WORKING",
    "REVISION",
  ]);

function parseRepository(
  value: string
) {
  const match =
    value.match(
      /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/
    );

  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

function isSafePath(
  path: string
) {
  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path.startsWith("\\")
  ) {
    return false;
  }

  const segments =
    path.split("/");

  if (
    segments.some(
      segment =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\")
    )
  ) {
    return false;
  }

  return true;
}

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

  const key =
    await importPKCS8(
      pem,
      "RS256"
    );

  const now =
    Math.floor(
      Date.now() / 1000
    );

  return new SignJWT({})
    .setProtectedHeader({
      alg: "RS256",
    })
    .setIssuer(appId)
    .setIssuedAt(now - 60)
    .setExpirationTime(
      now + 9 * 60
    )
    .sign(key);
}

async function getInstallationToken(
  owner: string,
  repo: string
) {
  const jwt =
    await createAppJwt();

  const installationRes =
    await fetch(
      `https://api.github.com/repos/${owner}/${repo}/installation`,
      {
        headers: {
          Authorization:
            `Bearer ${jwt}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2026-03-10",
        },

        cache: "no-store",
      }
    );

  if (
    !installationRes.ok
  ) {
    throw new Error(
      `Installation lookup failed: ${installationRes.status}`
    );
  }

  const installation =
    await installationRes.json();

  const tokenRes =
    await fetch(
      `https://api.github.com/app/installations/${installation.id}/access_tokens`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${jwt}`,

          Accept:
            "application/vnd.github+json",

          "X-GitHub-Api-Version":
            "2026-03-10",
        },

        cache: "no-store",
      }
    );

  if (!tokenRes.ok) {
    throw new Error(
      `Token creation failed: ${tokenRes.status}`
    );
  }

  const tokenData =
    await tokenRes.json();

  return tokenData.token as string;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  try {
    const { id } =
      await params;

    const url =
      new URL(
        request.url
      );

    const agentId =
      url.searchParams.get(
        "agentId"
      );

    const path =
      url.searchParams.get(
        "path"
      );

    if (!agentId) {
      return NextResponse.json(
        {
          error:
            "agent_id_required",
        },
        {
          status: 400,
        }
      );
    }

    const authorized =
      await verifyAgentToken(
        request,
        agentId
      );

    if (!authorized) {
      return NextResponse.json(
        {
          error:
            "invalid_agent_token",
        },
        {
          status: 401,
        }
      );
    }

    if (!path) {
      return NextResponse.json(
        {
          error:
            "path_required",
        },
        {
          status: 400,
        }
      );
    }

    if (!isSafePath(path)) {
      return NextResponse.json(
        {
          error:
            "invalid_path",
        },
        {
          status: 400,
        }
      );
    }

    const task =
      await db.task.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          status: true,
          assignedAgentId: true,
          githubRepo: true,
        },
      });

    if (!task) {
      return NextResponse.json(
        {
          error:
            "task_not_found",
        },
        {
          status: 404,
        }
      );
    }

    if (
      task.assignedAgentId !==
      agentId
    ) {
      return NextResponse.json(
        {
          error:
            "not_assigned_to_agent",
        },
        {
          status: 403,
        }
      );
    }

    if (
      !FILE_ACCESS_STATES.has(
        task.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "task_not_in_execution_state",

          status:
            task.status,
        },
        {
          status: 409,
        }
      );
    }

    if (!task.githubRepo) {
      return NextResponse.json(
        {
          error:
            "github_repo_missing",
        },
        {
          status: 400,
        }
      );
    }

    const repository =
      parseRepository(
        task.githubRepo
      );

    if (!repository) {
      return NextResponse.json(
        {
          error:
            "invalid_repository",
        },
        {
          status: 400,
        }
      );
    }

    const {
      owner,
      repo,
    } = repository;

    const token =
      await getInstallationToken(
        owner,
        repo
      );

    const repoRes =
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/vnd.github+json",

            "X-GitHub-Api-Version":
              "2026-03-10",
          },

          cache: "no-store",
        }
      );

    if (!repoRes.ok) {
      throw new Error(
        `Repository lookup failed: ${repoRes.status}`
      );
    }

    const repoData =
      await repoRes.json();

    const encodedPath =
      path
        .split("/")
        .map(
          segment =>
            encodeURIComponent(
              segment
            )
        )
        .join("/");

    const fileRes =
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(
          repoData.default_branch
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/vnd.github+json",

            "X-GitHub-Api-Version":
              "2026-03-10",
          },

          cache: "no-store",
        }
      );

    if (!fileRes.ok) {
      if (
        fileRes.status === 404
      ) {
        return NextResponse.json(
          {
            error:
              "file_not_found",
            path,
          },
          {
            status: 404,
          }
        );
      }

      throw new Error(
        `File lookup failed: ${fileRes.status}`
      );
    }

    const file =
      await fileRes.json();

    if (
      file.type !== "file"
    ) {
      return NextResponse.json(
        {
          error:
            "path_is_not_file",
        },
        {
          status: 400,
        }
      );
    }

    const maxBytes =
      256 * 1024;

    if (
      file.size >
      maxBytes
    ) {
      return NextResponse.json(
        {
          error:
            "file_too_large",
          maxBytes,
          size: file.size,
        },
        {
          status: 413,
        }
      );
    }

    const content =
      Buffer.from(
        (
          file.content || ""
        ).replace(
          /\n/g,
          ""
        ),
        "base64"
      ).toString(
        "utf8"
      );

    return NextResponse.json({
      taskId:
        task.id,

      repository:
        task.githubRepo,

      ref:
        repoData.default_branch,

      path:
        file.path,

      sha:
        file.sha,

      size:
        file.size,

      content,
    });
  } catch (e) {
    console.error(e);

    return apiError(e);
  }
}
