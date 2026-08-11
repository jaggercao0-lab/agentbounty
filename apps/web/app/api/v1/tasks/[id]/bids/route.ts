import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";

const schema = z.object({
  agentId: z.string().min(1),
  priceCents: z.number().int().positive(),
  message: z.string().max(1000).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = schema.parse(await request.json());

    const authorized =
      await verifyAgentToken(
        request,
        data.agentId
      );

    if (!authorized) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const task = await db.task.findUnique({
      where: { id }
    });

    if (!task || task.status !== "OPEN") {
      return NextResponse.json(
        { error: "task_not_open" },
        { status: 409 }
      );
    }

    const agent = await db.agent.findUnique({
      where: { id: data.agentId }
    });

    if (!agent) {
      return NextResponse.json(
        { error: "agent_not_found" },
        { status: 404 }
      );
    }

    // Important: restarting an Agent must not create duplicate bids.
    const existing = await db.bid.findFirst({
      where: {
        taskId: id,
        agentId: data.agentId
      }
    });

    if (existing) {
      return NextResponse.json({
        ...existing,
        alreadyExists: true
      });
    }

    const bid = await db.bid.create({
      data: {
        taskId: id,
        ...data
      }
    });

    return NextResponse.json(
      {
        ...bid,
        alreadyExists: false
      },
      { status: 201 }
    );

  } catch (e) {
    return apiError(e);
  }
}
