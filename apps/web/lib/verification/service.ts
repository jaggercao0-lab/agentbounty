import { db } from "@agentbounty/database";

import {
  getInstallationToken,
  githubFetch,
  parseGitHubRepository,
  parsePullRequestUrl,
} from "./github";

import { runVerification } from "./engine";
import { runArtifactVerification } from "./artifact";
import { taskEventData } from "@/lib/task-events";
import { safeStringArray } from "@/lib/task-types";

type VerificationReport =
  | Awaited<ReturnType<typeof runVerification>>
  | ReturnType<typeof runArtifactVerification>;

export type AutomaticVerificationResult =
  | {
      ok: true;
      taskId: string;
      status:
        | "SUBMITTED"
        | "VERIFYING"
        | "ACCEPTED"
        | "REVISION"
        | "CANCELLED";
      verificationStatus: "PASS" | "FAIL" | "PENDING";
      passed: boolean | null;
      report: VerificationReport;
    }
  | {
      ok: false;
      taskId: string;
      reason: string;
      status?: string;
    };

async function savePending(
  taskId: string,
  submissionId: string,
  report: VerificationReport
): Promise<AutomaticVerificationResult> {
  await db.submission.update({
    where: { id: submissionId },
    data: {
      verificationStatus: "PENDING",
      verificationReportJson: JSON.stringify(report),
      ciPassed: null,
      verifiedAt: null,
    },
  });

  await db.taskEvent.upsert({
    where: {
      dedupeKey: `submission:${submissionId}:verification:pending`,
    },
    update: {},
    create: taskEventData({
      taskId,
      type: "VERIFICATION_PENDING",
      actorType: "PLATFORM",
      message: "Verification is waiting for automatic evidence",
      metadata: {
        submissionId,
        verificationStatus: "PENDING",
      },
      dedupeKey: `submission:${submissionId}:verification:pending`,
    }),
  });

  return {
    ok: true,
    taskId,
    status: "SUBMITTED",
    verificationStatus: "PENDING",
    passed: null,
    report,
  };
}

async function finalizeReport({
  task,
  submission,
  report,
  ciPassed,
  requireOwnerReview,
}: {
  task: {
    id: string;
    status: string;
    revisionCount: number;
    includedRevisions: number;
  };
  submission: { id: string };
  report: VerificationReport;
  ciPassed: boolean | null;
  requireOwnerReview: boolean;
}): Promise<AutomaticVerificationResult> {
  if (report.status === "PENDING") {
    return savePending(task.id, submission.id, report);
  }

  const passed = report.status === "PASS";

  let nextStatus:
    | "VERIFYING"
    | "ACCEPTED"
    | "REVISION"
    | "CANCELLED";

  if (passed) {
    nextStatus = requireOwnerReview
      ? "VERIFYING"
      : "ACCEPTED";
  } else if (task.revisionCount < task.includedRevisions) {
    nextStatus = "REVISION";
  } else {
    nextStatus = "CANCELLED";
  }

  const updatedTask = await db.$transaction(async tx => {
    const updated = await tx.task.updateMany({
      where: {
        id: task.id,
        status: "SUBMITTED",
        revisionCount: task.revisionCount,
      },
      data: {
        status: nextStatus,
        ...(nextStatus === "REVISION"
          ? {
              revisionCount: {
                increment: 1,
              },
            }
          : {}),
      },
    });

    if (updated.count !== 1) {
      throw new Error("TASK_STATE_CHANGED");
    }

    await tx.submission.update({
      where: { id: submission.id },
      data: {
        ciPassed,
        verifiedAt: new Date(),
        verificationStatus: report.status,
        verificationReportJson: JSON.stringify(report),
      },
    });

    const eventType = passed
      ? requireOwnerReview
        ? "AUTOMATIC_VERIFICATION_PASSED"
        : "VERIFICATION_PASSED"
      : nextStatus === "REVISION"
        ? "REVISION_REQUESTED"
        : "CONTRACT_CANCELLED";

    const eventMessage = passed
      ? requireOwnerReview
        ? "Automatic verification passed; owner review required"
        : "Acceptance contract passed"
      : nextStatus === "REVISION"
        ? "Verification failed; revision requested"
        : "Verification failed; contract cancelled";

    await tx.taskEvent.create({
      data: taskEventData({
        taskId: task.id,
        type: eventType,
        actorType: "PLATFORM",
        message: eventMessage,
        metadata: {
          submissionId: submission.id,
          verificationStatus: report.status,
          nextStatus,
          requireOwnerReview,
        },
        dedupeKey:
          `submission:${submission.id}:verification:${report.status}:${nextStatus}`,
      }),
    });

    return tx.task.findUniqueOrThrow({
      where: { id: task.id },
    });
  });

  return {
    ok: true,
    taskId: task.id,
    status: updatedTask.status as
      | "VERIFYING"
      | "ACCEPTED"
      | "REVISION"
      | "CANCELLED",
    verificationStatus: report.status,
    passed,
    report,
  };
}

async function runGitHubVerification(task: any, submission: any) {
  if (!submission.pullRequestUrl || !task.githubRepo) {
    return {
      ok: false as const,
      reason: "submission_or_repository_missing",
    };
  }

  const repository = parseGitHubRepository(task.githubRepo);
  if (!repository) {
    return {
      ok: false as const,
      reason: "invalid_repository",
    };
  }

  const { owner, repo } = repository;
  const prNumber = parsePullRequestUrl(
    submission.pullRequestUrl,
    owner,
    repo
  );

  if (!prNumber) {
    return {
      ok: false as const,
      reason: "invalid_pull_request_url",
    };
  }

  const token = await getInstallationToken(owner, repo);
  const prResponse = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    token
  );

  if (!prResponse.ok) {
    return {
      ok: false as const,
      reason: `pull_request_lookup_failed:${prResponse.status}`,
    };
  }

  const pullRequest = await prResponse.json();
  const criteria = safeStringArray(task.acceptanceCriteriaJson);

  const report = await runVerification({
    owner,
    repo,
    githubRepo: task.githubRepo,
    pullRequestUrl: submission.pullRequestUrl,
    token,
    pullRequest,
    criteria,
  });

  const githubChecks = report.checks.find(
    check => check.type === "GITHUB_CHECKS"
  );

  const ciPassed = githubChecks
    ? githubChecks.status === "PASS"
    : false;

  return {
    ok: true as const,
    report,
    ciPassed,
  };
}

export async function verifySubmittedTask(
  taskId: string
): Promise<AutomaticVerificationResult> {
  const task = await db.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return {
      ok: false,
      taskId,
      reason: "task_not_found",
    };
  }

  if (task.status !== "SUBMITTED") {
    return {
      ok: false,
      taskId,
      reason: "task_not_submitted",
      status: task.status,
    };
  }

  if (task.verificationType === "MANUAL") {
    return {
      ok: false,
      taskId,
      reason: "manual_verification_required",
      status: task.status,
    };
  }

  const submission = await db.submission.findFirst({
    where: { taskId },
    orderBy: { createdAt: "desc" },
  });

  if (!submission) {
    return {
      ok: false,
      taskId,
      reason: "submission_missing",
    };
  }

  const requireOwnerReview = task.verificationType === "HYBRID";

  if (
    task.verificationType === "GITHUB" ||
    (task.verificationType === "HYBRID" &&
      task.deliveryType === "PULL_REQUEST")
  ) {
    const result = await runGitHubVerification(task, submission);

    if (!result.ok) {
      return {
        ok: false,
        taskId,
        reason: result.reason,
      };
    }

    return finalizeReport({
      task,
      submission,
      report: result.report,
      ciPassed: result.ciPassed,
      requireOwnerReview,
    });
  }

  const criteria = safeStringArray(task.acceptanceCriteriaJson);

  const report = runArtifactVerification({
    submission: {
      deliveryType: submission.deliveryType,
      pullRequestUrl: submission.pullRequestUrl,
      artifactUrl: submission.artifactUrl,
      textContent: submission.textContent,
      jsonContent: submission.jsonContent,
      mimeType: submission.mimeType,
    },
    criteria,
    allowManualCriteria: requireOwnerReview,
  });

  return finalizeReport({
    task,
    submission,
    report,
    ciPassed: null,
    requireOwnerReview,
  });
}
