import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import { taskEventData } from "@/lib/task-events";
import { safeStringArray } from "@/lib/task-types";

const CONTEXT_ACCESS_STATES =
  new Set([
    "ASSIGNED",
    "WORKING",
    "REVISION",
  ]);

const MAX_PREVIOUS_TEXT_CHARS = 60_000;
const MAX_PREVIOUS_JSON_CHARS = 100_000;
const MAX_VERIFICATION_REPORT_CHARS = 30_000;

function metadataFeedback(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return typeof parsed?.feedback === "string"
      ? parsed.feedback.slice(0, 3000)
      : null;
  } catch {
    return null;
  }
}

function bounded(
  value: string | null,
  maxChars: number
) {
  if (!value) return value;
  return value.length > maxChars
    ? `${value.slice(0, maxChars)}\n...[truncated]`
    : value;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "agent_id_required" },
        { status: 400 }
      );
    }

    const authorized = await verifyAgentToken(request, agentId);

    if (!authorized) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const task = await db.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (task.assignedAgentId !== agentId) {
      return NextResponse.json(
        { error: "not_assigned_to_agent" },
        { status: 403 }
      );
    }

    if (!CONTEXT_ACCESS_STATES.has(task.status)) {
      return NextResponse.json(
        {
          error: "task_not_in_execution_state",
          status: task.status,
        },
        { status: 409 }
      );
    }

    if (task.status === "ASSIGNED") {
      await db.task.updateMany({
        where: {
          id: task.id,
          assignedAgentId: agentId,
          status: "ASSIGNED",
        },
        data: {
          status: "WORKING",
        },
      });
    }

    let sourceData = null;
    if (task.sourceDataJson) {
      try {
        sourceData = JSON.parse(task.sourceDataJson);
      } catch {
        sourceData = null;
      }
    }

    let revision = null;

    if (task.status === "REVISION") {
      const [revisionEvent, previousSubmission] = await Promise.all([
        db.taskEvent.findFirst({
          where: {
            taskId: task.id,
            type: "REVISION_REQUESTED",
          },
          orderBy: { createdAt: "desc" },
        }),
        db.submission.findFirst({
          where: { taskId: task.id },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      revision = {
        number: task.revisionCount,
        feedback: metadataFeedback(
          revisionEvent?.metadataJson || null
        ),
        previousSubmission: previousSubmission
          ? {
              id: previousSubmission.id,
              deliveryType: previousSubmission.deliveryType,
              pullRequestUrl: previousSubmission.pullRequestUrl,
              artifactUrl: previousSubmission.artifactUrl,
              textContent: bounded(
                previousSubmission.textContent,
                MAX_PREVIOUS_TEXT_CHARS
              ),
              jsonContent: bounded(
                previousSubmission.jsonContent,
                MAX_PREVIOUS_JSON_CHARS
              ),
              mimeType: previousSubmission.mimeType,
              notes: previousSubmission.notes,
              verificationStatus:
                previousSubmission.verificationStatus,
              verificationReportJson: bounded(
                previousSubmission.verificationReportJson,
                MAX_VERIFICATION_REPORT_CHARS
              ),
              createdAt: previousSubmission.createdAt,
            }
          : null,
      };
    }

    await db.taskEvent.upsert({
      where: {
        dedupeKey: `task:${task.id}:execution:${task.revisionCount}`,
      },
      update: {},
      create: taskEventData({
        taskId: task.id,
        type: "EXECUTION_STARTED",
        actorType: "AGENT",
        actorId: agentId,
        message:
          task.revisionCount > 0
            ? "Agent started revision execution"
            : "Agent started execution",
        metadata: {
          revisionCount: task.revisionCount,
          workType: task.workType,
        },
        dedupeKey: `task:${task.id}:execution:${task.revisionCount}`,
      }),
    });

    return NextResponse.json({
      protocolVersion: "0.4",
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        workType: task.workType,
        deliveryType: task.deliveryType,
        verificationType: task.verificationType,
        bountyCents: task.bountyCents,
        executionFeeCents: task.executionFeeCents,
        successRewardCents: task.successRewardCents,
        includedRevisions: task.includedRevisions,
        revisionCount: task.revisionCount,
        acceptanceCriteria: safeStringArray(
          task.acceptanceCriteriaJson
        ),
        requiredCapabilities: safeStringArray(
          task.requiredCapabilitiesJson
        ),
        revision,
      },
      source: {
        type: task.sourceType,
        url:
          task.sourceType === "GITHUB_ISSUE"
            ? task.githubIssueUrl
            : task.sourceUrl,
        data: sourceData,
      },
      revision,
      github: task.githubRepo
        ? {
            repository: task.githubRepo,
            issueUrl: task.githubIssueUrl,
          }
        : null,
      submit: {
        endpoint: `/api/v1/tasks/${task.id}/submissions`,
        deliveryType: task.deliveryType,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
