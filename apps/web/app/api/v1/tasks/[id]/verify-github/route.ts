import {
  NextResponse,
} from "next/server";

import {
  db,
} from "@agentbounty/database";

import {
  authenticateWebRequest,
} from "@/lib/web-api-auth";

import {
  apiError,
} from "@/lib/http";

import {
  getInstallationToken,
  githubFetch,
  parseGitHubRepository,
  parsePullRequestUrl,
} from "@/lib/verification/github";

import {
  runVerification,
} from "@/lib/verification/engine";

export const runtime =
  "nodejs";

export async function POST(
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
    const user =
      await authenticateWebRequest(
        request
      );

    if (!user) {
      return NextResponse.json(
        {
          error:
            "unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } =
      await params;

    const task =
      await db.task.findFirst({
        where: {
          id,
          ownerId:
            user.id,
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
      task.status !==
      "SUBMITTED"
    ) {
      return NextResponse.json(
        {
          error:
            "task_not_submitted",

          status:
            task.status,
        },
        {
          status: 409,
        }
      );
    }

    const submission =
      await db.submission.findFirst({
        where: {
          taskId: id,
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
      return NextResponse.json(
        {
          error:
            "submission_or_repository_missing",
        },
        {
          status: 400,
        }
      );
    }

    const repository =
      parseGitHubRepository(
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

    const prNumber =
      parsePullRequestUrl(
        submission.pullRequestUrl,
        owner,
        repo
      );

    if (!prNumber) {
      return NextResponse.json(
        {
          error:
            "invalid_pull_request_url",
        },
        {
          status: 400,
        }
      );
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
      return NextResponse.json(
        {
          error:
            "pull_request_lookup_failed",

          githubStatus:
            prResponse.status,
        },
        {
          status: 502,
        }
      );
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
        Array.isArray(parsed)
      ) {
        criteria =
          parsed.filter(
            (
              item
            ): item is string =>
              typeof item ===
              "string"
          );
      }
    } catch {
      return NextResponse.json(
        {
          error:
            "invalid_acceptance_contract",
        },
        {
          status: 500,
        }
      );
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

    /*
     * PENDING is not a final verification.
     *
     * Keep the task SUBMITTED so the owner/platform
     * can retry once GitHub checks finish.
     */
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

      return NextResponse.json({
        passed: null,
        pending: true,

        taskId:
          task.id,

        pullRequest:
          submission.pullRequestUrl,

        report,

        status:
          "SUBMITTED",
      });
    }

    const passed =
      report.status ===
      "PASS";

    const checksResult =
      report.checks.find(
        check =>
          check.type ===
          "GITHUB_CHECKS"
      );

    const ciPassed =
      checksResult
        ? checksResult.status ===
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
          /*
           * Atomic state transition.
           *
           * Prevent two concurrent verification
           * requests from both consuming revisions.
           */
          const taskUpdate =
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
            taskUpdate.count !==
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

          return tx.task.findUniqueOrThrow({
            where: {
              id:
                task.id,
            },
          });
        }
      );

    return NextResponse.json({
      passed,

      pending:
        false,

      taskId:
        task.id,

      pullRequest:
        submission.pullRequestUrl,

      report,

      status:
        updatedTask.status,

      revisions: {
        used:
          updatedTask.revisionCount,

        included:
          updatedTask.includedRevisions,

        remaining:
          Math.max(
            0,
            updatedTask.includedRevisions -
              updatedTask.revisionCount
          ),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "TASK_STATE_CHANGED"
    ) {
      return NextResponse.json(
        {
          error:
            "task_state_changed",
        },
        {
          status: 409,
        }
      );
    }

    console.error(error);

    return apiError(error);
  }
}
