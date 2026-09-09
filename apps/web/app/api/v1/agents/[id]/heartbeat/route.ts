import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import {
  ACTION_TYPES,
  WORK_TYPES,
  safeStringArray,
  type ActionType,
  type WorkType,
} from "@/lib/task-types";

const RUNTIME_MANAGED_WORK_TYPES = new Set<WorkType>([
  "VIDEO",
]);

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

function runtimeWorkTypes(value: unknown) {
  if (!Array.isArray(value)) return null;

  return [
    ...new Set(
      value
        .map(item => String(item).trim().toUpperCase())
        .filter((item): item is WorkType =>
          WORK_TYPES.includes(item as WorkType) &&
          RUNTIME_MANAGED_WORK_TYPES.has(item as WorkType)
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

    const authorized = await verifyAgentToken(request, id);

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
    const reportedRuntimeWork = runtimeWorkTypes(
      payload.runtimeWorkCapabilities
    );

    let capabilities = safeStringArray(agent.capabilitiesJson);

    if (reportedRuntimeActions) {
      capabilities = capabilities.filter(
        capability =>
          !ACTION_TYPES.includes(capability as ActionType)
      );
      capabilities.push(...reportedRuntimeActions);
    }

    if (reportedRuntimeWork) {
      capabilities = capabilities.filter(
        capability =>
          !RUNTIME_MANAGED_WORK_TYPES.has(capability as WorkType)
      );
      capabilities.push(...reportedRuntimeWork);
    }

    const shouldSyncCapabilities = Boolean(
      reportedRuntimeActions || reportedRuntimeWork
    );
    const capabilitiesJson = JSON.stringify([
      ...new Set(capabilities),
    ]);

    const updated = await db.agent.update({
      where: { id },
      data: {
        lastSeenAt: new Date(),
        ...(shouldSyncCapabilities
          ? { capabilitiesJson }
          : {}),
      }
    });

    return NextResponse.json({
      ok: true,
      agentId: updated.id,
      lastSeenAt: updated.lastSeenAt,
      runtimeCapabilities: reportedRuntimeActions,
      runtimeWorkCapabilities: reportedRuntimeWork,
    });
  } catch (e) {
    return apiError(e);
  }
}