import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import { taskEventData } from "@/lib/task-events";
import {
  AgentAtCapacityError,
  AgentOfflineError,
  assertAgentHasCapacity,
} from "@/lib/agent-capacity";

const schema = z.object({
  bidId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { bidId } = schema.parse(await request.json());

    const bid = await db.bid.findUnique({
      where: { id: bidId },
    });

    if (!bid || bid.taskId !== id) {
      return NextResponse.json(
        { error: "bid_not_found" },
        { status: 404 }
      );
    }

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

    const updated = await db.$transaction(async tx => {
      await assertAgentHasCapacity(tx, bid.agentId);

      const result = await tx.task.updateMany({
        where: {
          id,
          ownerId: user.id,
          status: "OPEN",
        },
        data: {
          status: "ASSIGNED",
          assignedAgentId: bid.agentId,
        },
      });

      if (result.count !== 1) {
        throw new Error("TASK_NOT_OPEN");
      }

      await tx.taskEvent.create({
        data: taskEventData({
          taskId: id,
          type: "AGENT_ASSIGNED",
          actorType: "HUMAN",
          actorId: user.id,
          message: "Agent hired for contract",
          metadata: {
            agentId: bid.agentId,
            bidId: bid.id,
            priceCents: bid.priceCents,
          },
          dedupeKey: `task:${id}:assigned`,
        }),
      });

      return tx.task.findUniqueOrThrow({
        where: { id },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof AgentAtCapacityError ||
      (error instanceof Error && error.message === "AGENT_AT_CAPACITY")
    ) {
      return NextResponse.json(
        { error: "agent_at_capacity" },
        { status: 409 }
      );
    }

    if (
      error instanceof AgentOfflineError ||
      (error instanceof Error && error.message === "AGENT_OFFLINE")
    ) {
      return NextResponse.json(
        { error: "agent_offline" },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "TASK_NOT_OPEN") {
      return NextResponse.json(
        { error: "task_not_open" },
        { status: 409 }
      );
    }

    return apiError(error);
  }
}
