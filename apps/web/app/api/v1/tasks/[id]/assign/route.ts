import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";

const schema = z.object({
  bidId: z.string().min(1),
});

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
    const { bidId } =
      schema.parse(await request.json());

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

    const result = await db.task.updateMany({
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
      return NextResponse.json(
        { error: "task_not_open" },
        { status: 409 }
      );
    }

    const updated =
      await db.task.findUnique({
        where: { id },
      });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
