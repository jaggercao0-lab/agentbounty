import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import { apiError } from "@/lib/http";
import { verifySubmittedTask } from "@/lib/verification/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
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

    const ownedTask = await db.task.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
      select: {
        id: true,
        deliveryType: true,
        verificationType: true,
      },
    });

    if (!ownedTask) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (
      ownedTask.deliveryType !== "PULL_REQUEST" ||
      !["GITHUB", "HYBRID"].includes(
        ownedTask.verificationType
      )
    ) {
      return NextResponse.json(
        {
          error: "github_verification_not_configured",
          message:
            "Use the generic /verify endpoint for non-GitHub tasks.",
        },
        { status: 409 }
      );
    }

    const result = await verifySubmittedTask(id);

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason,
          status: result.status,
        },
        {
          status:
            result.reason === "task_not_submitted"
              ? 409
              : 400,
        }
      );
    }

    return NextResponse.json({
      passed: result.passed,
      pending:
        result.verificationStatus === "PENDING",
      verificationStatus:
        result.verificationStatus,
      taskId: result.taskId,
      report: result.report,
      status: result.status,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TASK_STATE_CHANGED"
    ) {
      return NextResponse.json(
        { error: "task_state_changed" },
        { status: 409 }
      );
    }

    console.error(error);
    return apiError(error);
  }
}
