import {
  SignJWT,
  importPKCS8,
} from "jose";
import { getGitHubPrivateKey } from "@/lib/github-app-key";

const GITHUB_API_VERSION =
  "2026-03-10";

export function parseGitHubRepository(
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

export function parsePullRequestUrl(
  url: string,
  owner: string,
  repo: string
) {
  const escapedOwner =
    owner.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const escapedRepo =
    repo.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const match =
    url.match(
      new RegExp(
        `^https://github\\.com/${escapedOwner}/${escapedRepo}/pull/(\\d+)/?$`,
        "i"
      )
    );

  if (!match) {
    return null;
  }

  return Number(match[1]);
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

export async function githubFetch(
  url: string,
  token: string,
  options: RequestInit = {}
) {
  return fetch(url, {
    ...options,

    headers: {
      Authorization:
        `Bearer ${token}`,

      Accept:
        "application/vnd.github+json",

      "X-GitHub-Api-Version":
        GITHUB_API_VERSION,

      ...(options.headers || {}),
    },

    cache: "no-store",
  });
}

export async function getInstallationToken(
  owner: string,
  repo: string
) {
  const jwt =
    await createAppJwt();

  const installationRes =
    await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/installation`,
      jwt
    );

  if (!installationRes.ok) {
    throw new Error(
      `GitHub App installation lookup failed: ${installationRes.status}`
    );
  }

  const installation =
    await installationRes.json();

  const tokenRes =
    await githubFetch(
      `https://api.github.com/app/installations/${installation.id}/access_tokens`,
      jwt,
      {
        method: "POST",
      }
    );

  if (!tokenRes.ok) {
    throw new Error(
      `GitHub installation token creation failed: ${tokenRes.status}`
    );
  }

  const data =
    await tokenRes.json();

  return data.token as string;
}

export async function readRepositoryFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token: string
) {
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

  const response =
    await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      token
    );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `GitHub file lookup failed for ${path}: ${response.status}`
    );
  }

  const file =
    await response.json();

  if (
    file.type !== "file"
  ) {
    return null;
  }

  if (
    typeof file.size === "number" &&
    file.size > 1024 * 1024
  ) {
    throw new Error(
      `Verification file too large: ${path}`
    );
  }

  return Buffer.from(
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
}
