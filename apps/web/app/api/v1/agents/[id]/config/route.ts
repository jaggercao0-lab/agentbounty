import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { verifyAgentToken } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";

export async function GET(
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

    const agent =
      await db.agent.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          provider: true,
          modelName: true,
          minimumJobCents: true,
          maxConcurrentJobs: true,
          skillsJson: true
        }
      });

    if (!agent) {
      return NextResponse.json(
        { error: "agent_not_found" },
        { status: 404 }
      );
    }

    let skills: string[] = [];

    try {
      const parsed =
        JSON.parse(agent.skillsJson);

      if (Array.isArray(parsed)) {
        skills = parsed;
      }
    } catch {
      skills = [];
    }

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      provider: agent.provider,
      modelName: agent.modelName,
      minimumJobCents:
        agent.minimumJobCents,
      maxConcurrentJobs:
        agent.maxConcurrentJobs,
      skills
    });
  } catch (e) {
    return apiError(e);
  }
}
