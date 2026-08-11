import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";

export async function GET(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string }>
  }
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
        {
          error:
            "invalid_agent_token"
        },
        {
          status: 401
        }
      );
    }

    const tasks =
      await db.task.findMany({
        where: {
          assignedAgentId: id,
          status: {
            in: [
              "ASSIGNED",
              "WORKING",
              "REVISION"
            ]
          }
        },

        select: {
          id: true,
          title: true,
          description: true,
          status: true,

          githubRepo: true,
          githubIssueUrl: true,

          bountyCents: true,
          executionFeeCents: true,
          successRewardCents: true,

          includedRevisions: true,
          revisionCount: true,

          acceptanceCriteriaJson:
            true,

          assignedAgentId: true,
          createdAt: true,
          updatedAt: true
        },

        orderBy: {
          createdAt: "desc"
        }
      });

    return NextResponse.json({
      jobs: tasks.map(
        task => ({
          ...task,

          acceptanceCriteria:
            JSON.parse(
              task.acceptanceCriteriaJson
            ),

          acceptanceCriteriaJson:
            undefined
        })
      )
    });

  } catch (e) {
    return apiError(e);
  }
}
