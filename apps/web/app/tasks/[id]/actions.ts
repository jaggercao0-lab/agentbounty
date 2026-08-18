"use server";

import { db } from "@agentbounty/database";
import { revalidatePath } from "next/cache";
import { requireWebUser } from "@/lib/web-session";
import { taskEventData } from "@/lib/task-events";

export async function hireBid(formData: FormData) {
  const user = await requireWebUser();

  const taskId = String(formData.get("taskId") || "");
  const bidId = String(formData.get("bidId") || "");

  if (!taskId || !bidId) {
    throw new Error("Missing task or bid");
  }

  const bid = await db.bid.findUnique({
    where: { id: bidId },
  });

  if (!bid || bid.taskId !== taskId) {
    throw new Error("Bid not found");
  }

  await db.$transaction(async tx => {
    const result = await tx.task.updateMany({
      where: {
        id: taskId,
        ownerId: user.id,
        status: "OPEN",
      },
      data: {
        status: "ASSIGNED",
        assignedAgentId: bid.agentId,
      },
    });

    if (result.count !== 1) {
      throw new Error(
        "Task is unavailable or you do not own it"
      );
    }

    await tx.taskEvent.create({
      data: taskEventData({
        taskId,
        type: "AGENT_ASSIGNED",
        actorType: "HUMAN",
        actorId: user.id,
        message: "Agent hired for task",
        metadata: {
          agentId: bid.agentId,
          bidId: bid.id,
          priceCents: bid.priceCents,
        },
        dedupeKey: `task:${taskId}:assigned`,
      }),
    });
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}

function manualReport(
  passed: boolean,
  pullRequestUrl: string | null,
  detail: string
) {
  const status = passed ? "PASS" : "FAIL";

  return {
    version: "0.4",
    status,
    passed,
    summary: {
      total: 1,
      passed: passed ? 1 : 0,
      failed: passed ? 0 : 1,
      pending: 0,
    },
    checks: [
      {
        type: "OWNER_REVIEW",
        criterion: "Owner reviewed delivery",
        status,
        detail,
      },
    ],
    pullRequestUrl: pullRequestUrl || "",
    verifiedAt: new Date().toISOString(),
  };
}

export async function reviewSubmission(formData: FormData) {
  const user = await requireWebUser();

  const taskId = String(formData.get("taskId") || "").trim();
  const decision = String(formData.get("decision") || "")
    .trim()
    .toUpperCase();
  const feedback = String(formData.get("feedback") || "").trim();

  if (!taskId || !["ACCEPT", "REVISION"].includes(decision)) {
    throw new Error("Invalid review request");
  }

  if (decision === "REVISION") {
    if (feedback.length < 3) {
      throw new Error("Revision feedback is required");
    }

    if (feedback.length > 3000) {
      throw new Error("Revision feedback is too long");
    }
  }

  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!task || task.ownerId !== user.id) {
    throw new Error("Task not found or not owned by user");
  }

  const validReviewState =
    task.verificationType === "MANUAL"
      ? task.status === "SUBMITTED"
      : task.verificationType === "HYBRID"
        ? task.status === "VERIFYING"
        : false;

  if (!validReviewState) {
    throw new Error("Task is not awaiting owner review");
  }

  const submission = task.submissions[0];
  if (!submission) {
    throw new Error("Submission not found");
  }

  await db.$transaction(async tx => {
    if (decision === "ACCEPT") {
      const result = await tx.task.updateMany({
        where: {
          id: task.id,
          ownerId: user.id,
          status: task.status,
        },
        data: {
          status: "ACCEPTED",
        },
      });

      if (result.count !== 1) {
        throw new Error("TASK_STATE_CHANGED");
      }

      await tx.submission.update({
        where: { id: submission.id },
        data: {
          verificationStatus: "PASS",
          verifiedAt: new Date(),
          verificationReportJson:
            submission.verificationReportJson ||
            JSON.stringify(
              manualReport(
                true,
                submission.pullRequestUrl,
                "Task owner accepted the submitted delivery."
              )
            ),
        },
      });

      await tx.taskEvent.create({
        data: taskEventData({
          taskId: task.id,
          type: "OWNER_REVIEW_ACCEPTED",
          actorType: "HUMAN",
          actorId: user.id,
          message: "Task owner accepted the delivery",
          metadata: {
            submissionId: submission.id,
            verificationType: task.verificationType,
          },
          dedupeKey: `submission:${submission.id}:owner:accepted`,
        }),
      });

      return;
    }

    const nextStatus =
      task.revisionCount < task.includedRevisions
        ? "REVISION"
        : "CANCELLED";

    const result = await tx.task.updateMany({
      where: {
        id: task.id,
        ownerId: user.id,
        status: task.status,
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

    if (result.count !== 1) {
      throw new Error("TASK_STATE_CHANGED");
    }

    const reportDetail =
      nextStatus === "REVISION"
        ? `Task owner requested a revision: ${feedback}`
        : `Task owner rejected the final delivery after revisions were exhausted: ${feedback}`;

    await tx.submission.update({
      where: { id: submission.id },
      data: {
        verificationStatus: "FAIL",
        verifiedAt: new Date(),
        verificationReportJson: JSON.stringify(
          manualReport(
            false,
            submission.pullRequestUrl,
            reportDetail
          )
        ),
      },
    });

    await tx.taskEvent.create({
      data: taskEventData({
        taskId: task.id,
        type:
          nextStatus === "REVISION"
            ? "REVISION_REQUESTED"
            : "CONTRACT_CANCELLED",
        actorType: "HUMAN",
        actorId: user.id,
        message:
          nextStatus === "REVISION"
            ? "Task owner requested a revision"
            : "Task cancelled after owner review",
        metadata: {
          submissionId: submission.id,
          verificationType: task.verificationType,
          nextStatus,
          feedback,
        },
        dedupeKey:
          `submission:${submission.id}:owner:${nextStatus.toLowerCase()}`,
      }),
    });
  });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}
