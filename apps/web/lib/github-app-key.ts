import fs from "fs";

export function getGitHubPrivateKey() {
  const inlineKey =
    process.env.GITHUB_PRIVATE_KEY
      ?.trim();

  if (inlineKey) {
    return inlineKey.replace(
      /\\n/g,
      "\n"
    );
  }

  const privateKeyPath =
    process.env
      .GITHUB_PRIVATE_KEY_PATH
      ?.trim();

  if (privateKeyPath) {
    return fs.readFileSync(
      privateKeyPath,
      "utf8"
    );
  }

  throw new Error(
    "Missing GitHub App private key configuration"
  );
}
