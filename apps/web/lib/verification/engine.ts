import {
  parseCriterion,
} from "./criteria";

import {
  buildVerificationReport,
  type VerificationCheck,
  type VerificationCheckType,
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

type GitHubCheckRun = {
  name?: string;
  status?: string;
  conclusion?: string | null;
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

function matchesPreset(
  type: "BUILD" | "TESTS" | "LINT",
  name: string
) {
  const value =
    name.toLowerCase();

  if (
    type === "BUILD"
  ) {
    return (
      /\bbuild\b/.test(value) ||
      /\bcompile\b/.test(value) ||
      /\btypecheck\b/.test(value) ||
      /\btype-check\b/.test(value) ||
      /\btsc\b/.test(value)
    );
  }

  if (
    type === "TESTS"
  ) {
    return (
      /\btest\b/.test(value) ||
      /\btests\b/.test(value) ||
      /\bpytest\b/.test(value) ||
      /\bjest\b/.test(value) ||
      /\bvitest\b/.test(value) ||
      /\bunit\b/.test(value) ||
      /\bintegration\b/.test(value)
    );
  }

  return (
    /\blint\b/.test(value) ||
    /\beslint\b/.test(value) ||
    /\bruff\b/.test(value) ||
    /\bflake8\b/.test(value) ||
    /\bpylint\b/.test(value)
  );
}

function presetCheck(
  type:
    | "BUILD"
    | "TESTS"
    | "LINT",
  criterion: string,
  githubChecks:
    GitHubCheckRun[] | null,
  githubChecksError:
    string | null
): VerificationCheck {
  if (
    githubChecksError
  ) {
    return {
      type,
      criterion,
      status: "FAIL",
      detail:
        githubChecksError,
    };
  }

  if (!githubChecks) {
    return {
      type,
      criterion,
      status: "FAIL",
      detail:
        "GitHub checks were unavailable",
    };
  }

  const matching =
    githubChecks.filter(
      check =>
        matchesPreset(
          type,
          check.name || ""
        )
    );

  if (
    matching.length === 0
  ) {
    return {
      type,
      criterion,
      status: "FAIL",
      detail:
        `No ${type.toLowerCase()}-related GitHub check was found`,
    };
  }

  const pending =
    matching.some(
      check =>
        check.status !==
        "completed"
    );

  const names =
    matching
      .map(
        check =>
          check.name ||
          "unnamed check"
      )
      .slice(0, 5)
      .join(", ");

  if (pending) {
    return {
      type,
      criterion,
      status:
        "PENDING",

      detail:
        `Waiting for: ${names}`,
    };
  }

  const passed =
    matching.every(
      check =>
        check.conclusion ===
        "success"
    );

  return {
    type,
    criterion,

    status:
      passed
        ? "PASS"
        : "FAIL",

    detail:
      passed
        ? `Required GitHub check(s) passed: ${names}`
        : `At least one required GitHub check failed or was skipped: ${names}`,
  };
}

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
    pullRequest.state ===
      "open" &&
    !pullRequest.draft &&
    pullRequest.base.repo
      .full_name ===
      githubRepo;

  checks.push({
    type:
      "PULL_REQUEST",

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

  /*
   * Fetch GitHub Check Runs once.
   *
   * BUILD / TESTS / LINT presets inspect this
   * trusted GitHub evidence. AgentBounty does
   * not execute arbitrary task-provided shell.
   */
  const checksResponse =
    await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${pullRequest.head.sha}/check-runs`,
      token
    );

  let githubChecks:
    GitHubCheckRun[] | null =
      null;

  let githubChecksError:
    string | null =
      null;

  if (
    !checksResponse.ok
  ) {
    githubChecksError =
      `Unable to inspect GitHub checks: HTTP ${checksResponse.status}`;
  } else {
    const data =
      await checksResponse.json();

    githubChecks =
      Array.isArray(
        data.check_runs
      )
        ? data.check_runs
        : [];
  }

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
        type:
          "PULL_REQUEST",

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
        "BUILD" ||
      criterion.type ===
        "TESTS" ||
      criterion.type ===
        "LINT"
    ) {
      checks.push(
        presetCheck(
          criterion.type,
          criterion.raw,
          githubChecks,
          githubChecksError
        )
      );

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
        type:
          "FILE_EXISTS",

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
      type:
        "UNSUPPORTED",

      criterion:
        criterion.raw,

      status:
        "FAIL",

      detail:
        "No deterministic verifier exists for this criterion",
    });
  }

  /*
   * Always include an overall GitHub Checks
   * health result in addition to any explicit
   * BUILD / TESTS / LINT requirements.
   */
  if (
    githubChecksError
  ) {
    checks.push({
      type:
        "GITHUB_CHECKS",

      criterion:
        "GitHub checks",

      status:
        "FAIL",

      detail:
        githubChecksError,
    });
  } else if (
    !githubChecks ||
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
        check =>
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
          check =>
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

  return buildVerificationReport(
    checks,
    pullRequestUrl
  );
}
