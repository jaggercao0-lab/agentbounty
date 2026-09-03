import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";

import { authenticateAgentRequest } from "@/lib/agent-auth";
import { apiError } from "@/lib/http";
import { createArtifactUpload } from "@/lib/artifact-storage";

const schema = z.object({
  contentType: z.string().trim().min(1).max(200),
  contentLength: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticateAgentRequest(request);

    if (!agent) {
      return NextResponse.json(
        { error: "invalid_agent_token" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const payload = schema.parse(await request.json());

    const task = await db.task.findUnique({
      where: { id },
      select: {
        id: true,
        assignedAgentId: true,
        status: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (task.assignedAgentId !== agent.id) {
      return NextResponse.json(
        { error: "task_not_assigned_to_agent" },
        { status: 403 }
      );
    }

    if (!["ASSIGNED", "WORKING", "REVISION"].includes(task.status)) {
      return NextResponse.json(
        {
          error: "artifact_upload_not_allowed",
          status: task.status,
        },
        { status: 409 }
      );
    }

    const grant = createArtifactUpload({
      taskId: task.id,
      agentId: agent.id,
      contentType: payload.contentType,
      contentLength: payload.contentLength,
    });

    return NextResponse.json({
      ok: true,
      ...grant,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "artifact_storage_not_configured") {
        return NextResponse.json(
          { error: error.message },
          { status: 503 }
        );
      }

      if (
        [
          "unsupported_artifact_mime_type",
          "invalid_artifact_size",
        ].includes(error.message)
      ) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return apiError(error);
  }
}
