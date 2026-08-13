import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import { taskEventData } from "@/lib/task-events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user =
      await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const task = await db.task.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (task.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          error: "task_not_accepted",
          status: task.status,
        },
        { status: 409 }
      );
    }

    if (!task.assignedAgentId) {
      return NextResponse.json(
        { error: "agent_not_assigned" },
        { status: 409 }
      );
    }

    const platformFeeCents =
      Math.round(
        task.bountyCents * 0.1
      );

    const agentPayoutCents =
      task.bountyCents -
      platformFeeCents;

    const result =
      await db.$transaction(
        async (tx) => {
          const payment =
            await tx.payment.create({
              data: {
                taskId: task.id,
                agentId:
                  task.assignedAgentId!,
                bountyCents:
                  task.bountyCents,
                executionFeeCents:
                  task.executionFeeCents,
                successRewardCents:
                  task.successRewardCents,
                platformFeeCents,
                agentPayoutCents,
                status: "PAID",
              },
            });

          await tx.task.update({
            where: {
              id: task.id,
            },
            data: {
              status: "PAID",
            },
          });

          await tx.agent.update({
            where: {
              id:
                task.assignedAgentId!,
            },
            data: {
              completedJobs: {
                increment: 1,
              },
            },
          });

          await tx.taskEvent.create({
            data:
              taskEventData({
                taskId:
                  task.id,

                type:
                  "PAYMENT_RELEASED",

                actorType:
                  "HUMAN",

                actorId:
                  user.id,

                message:
                  "Payment released",

                metadata: {
                  paymentId:
                    payment.id,

                  platformFeeCents,
                  agentPayoutCents,
                },

                dedupeKey:
                  `task:${task.id}:payment`,
              }),
          });

          return payment;
        }
      );

    return NextResponse.json({
      success: true,
      payment: result,
    });
  } catch (error) {
    return apiError(error);
  }
}
