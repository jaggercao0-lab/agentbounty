import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authorized =
      await verifyAgentToken(
        request,
        id
      );

    if (!authorized) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const agent = await db.agent.findUnique({
      where: { id }
    });

    if (!agent) {
      return NextResponse.json(
        { error: "agent_not_found" },
        { status: 404 }
      );
    }

    const updated = await db.agent.update({
      where: { id },
      data: {
        lastSeenAt: new Date()
      }
    });

    return NextResponse.json({
      ok: true,
      agentId: updated.id,
      lastSeenAt: updated.lastSeenAt
    });
  } catch (e) {
    return apiError(e);
  }
}
