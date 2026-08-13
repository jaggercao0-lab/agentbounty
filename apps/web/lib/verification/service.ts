import {
  db,
} from "@agentbounty/database";

import {
  getInstallationToken,
  githubFetch,
  parseGitHubRepository,
  parsePullRequestUrl,
} from "./github";

import {
  runVerification,
} from "./engine";

import {
  taskEventData,
} from "@/lib/task-events";

export type AutomaticVerificationResult =
  | {
      ok: true;
      taskId: string;
      status:
        | "SUBMITTED"
        | "ACCEPTED"
        | "REVISION"
        | "CANCELLED";
      verificationStatus:
        | "PASS"
        | "FAIL"
        | "PENDING";
      passed:
        | boolean
        | null;
      report: Awaited<
        ReturnType<
          typeof runVerification
        >
      >;
    }
  | {
      ok: false;
      taskId: string;
      reason: string;
      status?: string;
    };

export async function verifySubmittedTask(
  taskId: string
): Promise<AutomaticVerificationResult> {
  const task =
    await db.task.findUnique({
      where: {
        id: taskId,
      },
    });

  if (!task) {
    return {
      ok: false,
      taskId,
      reason:
        "task_not_found",
    };
  }

  if (
    task.status !==
    "SUBMITTED"
  ) {
    return {
      ok: false,
      taskId,
      reason:
        "task_not_submitted",
      status:
        task.status,
    };
  }

  const submission =
    await db.submission.findFirst({
      where: {
        taskId,
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  if (
    !submission ||
    !submission.pullRequestUrl ||
    !task.githubRepo
  ) {
    return {
      ok: false,
      taskId,
      reason:
        "submission_or_repository_missing",
    };
  }

  const repository =
    parseGitHubRepository(
      task.githubRepo
    );

  if (!repository) {
    return {
      ok: false,
      taskId,
      reason:
        "invalid_repository",
    };
  }

  const {
    owner,
    repo,
  } = repository;

  const prNumber =
    parsePullRequestUrl(
      submission.pullRequestUrl,
      owner,
      repo
    );

  if (!prNumber) {
    return {
      ok: false,
      taskId,
      reason:
        "invalid_pull_request_url",
    };
  }

  const token =
    await getInstallationToken(
      owner,
      repo
    );

  const prResponse =
    await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      token
    );

  if (!prResponse.ok) {
    return {
      ok: false,
      taskId,
      reason:
        `pull_request_lookup_failed:${prResponse.status}`,
    };
  }

  const pullRequest =
    await prResponse.json();

  let criteria:
    string[] = [];

  try {
    const parsed =
      JSON.parse(
        task.acceptanceCriteriaJson
      );

    if (
      !Array.isArray(parsed)
    ) {
      return {
        ok: false,
        taskId,
        reason:
          "invalid_acceptance_contract",
      };
    }

    criteria =
      parsed.filter(
        (
          item
        ): item is string =>
          typeof item ===
          "string"
      );
  } catch {
    return {
      ok: false,
      taskId,
      reason:
        "invalid_acceptance_contract",
    };
  }

  const report =
    await runVerification({
      owner,
      repo,

      githubRepo:
        task.githubRepo,

      pullRequestUrl:
        submission.pullRequestUrl,

      token,
      pullRequest,
      criteria,
    });

  if (
    report.status ===
    "PENDING"
  ) {
    await db.submission.update({
      where: {
        id:
          submission.id,
      },

      data: {
        verificationStatus:
          "PENDING",

        verificationReportJson:
          JSON.stringify(
            report
          ),

        ciPassed:
          null,

        verifiedAt:
          null,
      },
    });

    await db.taskEvent.upsert({
      where: {
        dedupeKey:
          `submission:${submission.id}:verification:pending`,
      },

      update: {},

      create:
        taskEventData({
          taskId,

          type:
            "VERIFICATION_PENDING",

          actorType:
            "PLATFORM",

          message:
            "Verification waiting for GitHub evidence",

          metadata: {
            submissionId:
              submission.id,

            verificationStatus:
              "PENDING",
          },

          dedupeKey:
            `submission:${submission.id}:verification:pending`,
        }),
    });

    return {
      ok: true,
      taskId,
      status:
        "SUBMITTED",
      verificationStatus:
        "PENDING",
      passed:
        null,
      report,
    };
  }

  const passed =
    report.status ===
    "PASS";

  const githubChecks =
    report.checks.find(
      check =>
        check.type ===
        "GITHUB_CHECKS"
    );

  const ciPassed =
    githubChecks
      ? githubChecks.status ===
        "PASS"
      : false;

  let nextStatus:
    | "ACCEPTED"
    | "REVISION"
    | "CANCELLED";

  if (passed) {
    nextStatus =
      "ACCEPTED";
  } else if (
    task.revisionCount <
    task.includedRevisions
  ) {
    nextStatus =
      "REVISION";
  } else {
    nextStatus =
      "CANCELLED";
  }

  const updatedTask =
    await db.$transaction(
      async tx => {
        const updated =
          await tx.task.updateMany({
            where: {
              id:
                task.id,

              status:
                "SUBMITTED",

              revisionCount:
                task.revisionCount,
            },

            data: {
              status:
                nextStatus,

              ...(nextStatus ===
              "REVISION"
                ? {
                    revisionCount:
                      {
                        increment:
                          1,
                      },
                  }
                : {}),
            },
          });

        if (
          updated.count !==
          1
        ) {
          throw new Error(
            "TASK_STATE_CHANGED"
          );
        }

        await tx.submission.update({
          where: {
            id:
              submission.id,
          },

          data: {
            ciPassed,

            verifiedAt:
              new Date(),

            verificationStatus:
              report.status,

            verificationReportJson:
              JSON.stringify(
                report
              ),
          },
        });

        const eventType =
          passed
            ? "VERIFICATION_PASSED"
            : nextStatus ===
                "REVISION"
              ? "REVISION_REQUESTED"
              : "CONTRACT_CANCELLED";

        const eventMessage =
          passed
            ? "Acceptance contract passed"
            : nextStatus ===
                "REVISION"
              ? "Verification failed; revision requested"
              : "Verification failed; contract cancelled";

        await tx.taskEvent.create({
          data:
            taskEventData({
              taskId:
                task.id,

              type:
                eventType,

              actorType:
                "PLATFORM",

              message:
                eventMessage,

              metadata: {
                submissionId:
                  submission.id,

                verificationStatus:
                  report.status,

                nextStatus,
              },

              dedupeKey:
                `submission:${submission.id}:verification:${report.status}`,
            }),
        });

        return tx.task.findUniqueOrThrow({
          where: {
            id:
              task.id,
          },
        });
      }
    );

  return {
    ok: true,
    taskId,
    status:
      updatedTask.status as
        | "ACCEPTED"
        | "REVISION"
        | "CANCELLED",
    verificationStatus:
      report.status,
    passed,
    report,
  };
}
