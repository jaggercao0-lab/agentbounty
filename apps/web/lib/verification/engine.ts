import {
  parseCriterion,
} from "./criteria";

import {
  buildVerificationReport,
  type VerificationCheck,
} from "./types";

import {
  githubFetch,
  readRepositoryFile,
} from "./github";

type PullRequestData = {
  state: string;
  draft: boolean;
  base: {
    ref: string;
    repo: {
      full_name: string;
    };
  };
  head: {
    ref: string;
    sha: string;
  };
};

type VerifyInput = {
  owner: string;
  repo: string;
  githubRepo: string;
  pullRequestUrl: string;
  token: string;
  pullRequest: PullRequestData;
  criteria: string[];
};

export async function runVerification(
  input: VerifyInput
) {
  const {
    owner,
    repo,
    githubRepo,
    pullRequestUrl,
    token,
    pullRequest,
    criteria,
  } = input;

  const checks:
    VerificationCheck[] = [];

  const prValid =
    pullRequest.state === "open" &&
    !pullRequest.draft &&
    pullRequest.base.repo.full_name ===
      githubRepo;

  checks.push({
    type: "PULL_REQUEST",
    criterion:
      "Pull request is valid",

    status:
      prValid
        ? "PASS"
        : "FAIL",

    detail:
      prValid
        ? pullRequestUrl
        : "PR must be open, non-draft, and target the contract repository",
  });

  for (
    const rawCriterion
    of criteria
  ) {
    const criterion =
      parseCriterion(
        rawCriterion
      );

    if (
      criterion.type ===
      "PULL_REQUEST"
    ) {
      checks.push({
        type: "PULL_REQUEST",

        criterion:
          criterion.raw,

        status:
          prValid
            ? "PASS"
            : "FAIL",

        detail:
          pullRequestUrl,
      });

      continue;
    }

    if (
      criterion.type ===
      "FILE_EXISTS"
    ) {
      const content =
        await readRepositoryFile(
          owner,
          repo,
          criterion.path,
          pullRequest.head.ref,
          token
        );

      checks.push({
        type: "FILE_EXISTS",

        criterion:
          criterion.raw,

        status:
          content !== null
            ? "PASS"
            : "FAIL",

        detail:
          content !== null
            ? `${criterion.path} exists on PR branch`
            : `${criterion.path} was not found on PR branch`,
      });

      continue;
    }

    if (
      criterion.type ===
      "CONTENT_CONTAINS"
    ) {
      const content =
        await readRepositoryFile(
          owner,
          repo,
          criterion.path,
          pullRequest.head.ref,
          token
        );

      const found =
        content !== null &&
        content.includes(
          criterion.value
        );

      checks.push({
        type:
          "CONTENT_CONTAINS",

        criterion:
          criterion.raw,

        status:
          found
            ? "PASS"
            : "FAIL",

        detail:
          content === null
            ? `${criterion.path} was not found`
            : found
              ? `${criterion.path} contains the required content`
              : `${criterion.path} does not contain the required content`,
      });

      continue;
    }

    if (
      criterion.type ===
      "CONTENT_PRESERVED"
    ) {
      const [
        baseContent,
        headContent,
      ] =
        await Promise.all([
          readRepositoryFile(
            owner,
            repo,
            criterion.path,
            pullRequest.base.ref,
            token
          ),

          readRepositoryFile(
            owner,
            repo,
            criterion.path,
            pullRequest.head.ref,
            token
          ),
        ]);

      let preserved =
        false;

      if (
        baseContent !== null &&
        headContent !== null
      ) {
        const originalLines =
          baseContent
            .split("\n")
            .map(
              line =>
                line.trim()
            )
            .filter(Boolean);

        preserved =
          originalLines.every(
            line =>
              headContent.includes(
                line
              )
          );
      }

      checks.push({
        type:
          "CONTENT_PRESERVED",

        criterion:
          criterion.raw,

        status:
          preserved
            ? "PASS"
            : "FAIL",

        detail:
          preserved
            ? `Existing ${criterion.path} content was preserved`
            : `Existing ${criterion.path} content was not fully preserved`,
      });

      continue;
    }

    checks.push({
      type: "UNSUPPORTED",

      criterion:
        criterion.raw,

      status: "FAIL",

      detail:
        "No deterministic verifier exists for this criterion",
    });
  }

  const checksResponse =
    await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${pullRequest.head.sha}/check-runs`,
      token
    );

  if (
    !checksResponse.ok
  ) {
    checks.push({
      type: "GITHUB_CHECKS",

      criterion:
        "GitHub checks",

      status:
        "FAIL",

      detail:
        `Unable to inspect GitHub checks: HTTP ${checksResponse.status}`,
    });
  } else {
    const checkData =
      await checksResponse.json();

    const githubChecks =
      Array.isArray(
        checkData.check_runs
      )
        ? checkData.check_runs
        : [];

    if (
      githubChecks.length ===
      0
    ) {
      checks.push({
        type:
          "GITHUB_CHECKS",

        criterion:
          "GitHub checks",

        status:
          "PASS",

        detail:
          "No GitHub checks are configured for this commit",
      });
    } else {
      const pending =
        githubChecks.some(
          (
            check: {
              status?: string;
            }
          ) =>
            check.status !==
            "completed"
        );

      if (pending) {
        checks.push({
          type:
            "GITHUB_CHECKS",

          criterion:
            "GitHub checks",

          status:
            "PENDING",

          detail:
            `${githubChecks.length} GitHub check(s), at least one still running`,
        });
      } else {
        const passed =
          githubChecks.every(
            (
              check: {
                conclusion?: string;
              }
            ) =>
              [
                "success",
                "neutral",
                "skipped",
              ].includes(
                check.conclusion ||
                  ""
              )
          );

        checks.push({
          type:
            "GITHUB_CHECKS",

          criterion:
            "GitHub checks",

          status:
            passed
              ? "PASS"
              : "FAIL",

          detail:
            passed
              ? `${githubChecks.length} completed GitHub check(s) passed`
              : `${githubChecks.length} completed GitHub check(s) evaluated; at least one failed`,
        });
      }
    }
  }

  return buildVerificationReport(
    checks,
    pullRequestUrl
  );
}
