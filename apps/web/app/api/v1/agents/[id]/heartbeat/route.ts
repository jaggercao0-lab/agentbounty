import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import {
  ACTION_TYPES,
  safeStringArray,
  type ActionType,
} from "@/lib/task-types";

function runtimeActions(value: unknown) {
  if (!Array.isArray(value)) return null;

  return [
    ...new Set(
      value
        .map(item => String(item).trim().toUpperCase())
        .filter((item): item is ActionType =>
          ACTION_TYPES.includes(item as ActionType)
        )
    ),
  ];
}

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

    let payload: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = {};
    }

    const reportedRuntimeActions = runtimeActions(
      payload.runtimeCapabilities
    );

    let capabilitiesJson = agent.capabilitiesJson;

    if (reportedRuntimeActions) {
      const preservedCapabilities = safeStringArray(
        agent.capabilitiesJson
      ).filter(
        capability =>
          !ACTION_TYPES.includes(capability as ActionType)
      );

      capabilitiesJson = JSON.stringify([
        ...new Set([
          ...preservedCapabilities,
          ...reportedRuntimeActions,
        ]),
      ]);
    }

    const updated = await db.agent.update({
      where: { id },
      data: {
        lastSeenAt: new Date(),
        ...(reportedRuntimeActions
          ? { capabilitiesJson }
          : {}),
      }
    });

    return NextResponse.json({
      ok: true,
      agentId: updated.id,
      lastSeenAt: updated.lastSeenAt,
      runtimeCapabilities: reportedRuntimeActions,
    });
  } catch (e) {
    return apiError(e);
  }
}
