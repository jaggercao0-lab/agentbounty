import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import { safeStringArray } from "@/lib/task-types";

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

    const authorized = await verifyAgentToken(request, id);

    if (!authorized) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const generalProtocol =
      url.searchParams.get("protocol") === "0.4";

    const tasks = await db.task.findMany({
      where: {
        assignedAgentId: id,
        status: {
          in: ["ASSIGNED", "WORKING", "REVISION"],
        },
        ...(
          generalProtocol
            ? {}
            : {
                workType: "CODE",
                deliveryType: "PULL_REQUEST",
              }
        ),
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        workType: true,
        sourceType: true,
        sourceUrl: true,
        sourceDataJson: true,
        deliveryType: true,
        verificationType: true,
        requiredCapabilitiesJson: true,
        githubRepo: true,
        githubIssueUrl: true,
        bountyCents: true,
        executionFeeCents: true,
        successRewardCents: true,
        includedRevisions: true,
        revisionCount: true,
        acceptanceCriteriaJson: true,
        assignedAgentId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      protocolVersion:
        generalProtocol
          ? "0.4"
          : "0.3",
      jobs: tasks.map(task => ({
        ...task,
        acceptanceCriteria: safeStringArray(
          task.acceptanceCriteriaJson
        ),
        requiredCapabilities: safeStringArray(
          task.requiredCapabilitiesJson
        ),
        sourceData: task.sourceDataJson
          ? (() => {
              try {
                return JSON.parse(task.sourceDataJson);
              } catch {
                return null;
              }
            })()
          : null,
        acceptanceCriteriaJson: undefined,
        requiredCapabilitiesJson: undefined,
        sourceDataJson: undefined,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
