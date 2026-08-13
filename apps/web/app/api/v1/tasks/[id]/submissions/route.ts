import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateAgentRequest } from "@/lib/agent-auth";
import { taskEventData } from "@/lib/task-events";

const schema = z.object({
  // Kept temporarily for backwards compatibility
  // with older runners. The token remains authoritative.
  agentId: z.string().min(1).optional(),
  pullRequestUrl: z.string().url(),
  notes: z.string().max(5000).optional(),
});

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const agent =
      await authenticateAgentRequest(request);

    if (!agent) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const data =
      schema.parse(await request.json());

    // Do not allow a runner to impersonate another agent.
    if (
      data.agentId &&
      data.agentId !== agent.id
    ) {
      return NextResponse.json(
        { error: "agent_id_mismatch" },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (
      task.assignedAgentId !== agent.id
    ) {
      return NextResponse.json(
        {
          error:
            "task_not_assigned_to_agent",
        },
        { status: 403 }
      );
    }

    if (
      ![
        "ASSIGNED",
        "WORKING",
        "REVISION",
      ].includes(task.status)
    ) {
      return NextResponse.json(
        {
          error: "task_not_submittable",
          status: task.status,
        },
        { status: 409 }
      );
    }

    const submission =
      await db.$transaction(async (tx) => {
        const updated =
          await tx.task.updateMany({
            where: {
              id,
              assignedAgentId: agent.id,
              status: {
                in: [
                  "ASSIGNED",
                  "WORKING",
                  "REVISION",
                ],
              },
            },
            data: {
              status: "SUBMITTED",
            },
          });

        if (updated.count !== 1) {
          throw new Error(
            "TASK_STATE_CHANGED"
          );
        }

        const created =
          await tx.submission.create({
            data: {
              taskId:
                id,

              agentId:
                agent.id,

              pullRequestUrl:
                data.pullRequestUrl,

              notes:
                data.notes,
            },
          });

        await tx.taskEvent.create({
          data:
            taskEventData({
              taskId:
                id,

              type:
                "DELIVERY_SUBMITTED",

              actorType:
                "AGENT",

              actorId:
                agent.id,

              message:
                "Pull request submitted",

              metadata: {
                submissionId:
                  created.id,

                pullRequestUrl:
                  created.pullRequestUrl,
              },

              dedupeKey:
                `submission:${created.id}:submitted`,
            }),
        });

        return created;
      });

    return NextResponse.json(
      submission,
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "TASK_STATE_CHANGED"
    ) {
      return NextResponse.json(
        {
          error:
            "task_not_submittable",
        },
        { status: 409 }
      );
    }

    return apiError(error);
  }
}
