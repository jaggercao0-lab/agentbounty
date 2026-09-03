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

    if (task.status === "PAID") {
      const existingPayment = await db.payment.findUnique({
        where: { taskId: task.id },
      });

      if (existingPayment) {
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          payment: existingPayment,
        });
      }
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

    try {
      const result =
        await db.$transaction(
          async (tx) => {
            const claimed = await tx.task.updateMany({
              where: {
                id: task.id,
                ownerId: user.id,
                status: "ACCEPTED",
              },
              data: {
                status: "PAID",
              },
            });

            if (claimed.count !== 1) {
              throw new Error("TASK_STATE_CHANGED");
            }

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
        alreadyPaid: false,
        payment: result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "TASK_STATE_CHANGED"
      ) {
        const [currentTask, existingPayment] = await Promise.all([
          db.task.findFirst({
            where: {
              id: task.id,
              ownerId: user.id,
            },
            select: { status: true },
          }),
          db.payment.findUnique({
            where: { taskId: task.id },
          }),
        ]);

        if (currentTask?.status === "PAID" && existingPayment) {
          return NextResponse.json({
            success: true,
            alreadyPaid: true,
            payment: existingPayment,
          });
        }

        return NextResponse.json(
          {
            error: "task_state_changed",
            status: currentTask?.status,
          },
          { status: 409 }
        );
      }

      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}
