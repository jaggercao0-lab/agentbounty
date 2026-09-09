import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { verifyInternalRequest } from "@/lib/internal-auth";
import { verifySubmittedTask } from "@/lib/verification/service";

export const runtime = "nodejs";

const BATCH_SIZE = 5;

export async function POST(request: Request) {
  try {
    if (!process.env.AGENTBOUNTY_INTERNAL_KEY) {
      return NextResponse.json(
        { error: "internal_auth_not_configured" },
        { status: 503 }
      );
    }

    if (!verifyInternalRequest(request)) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const tasks = await db.task.findMany({
      where: {
        status: "SUBMITTED",
        verificationType: {
          in: ["GITHUB", "AUTOMATIC", "HYBRID"],
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        title: true,
        verificationType: true,
      },
    });

    const results = [];

    for (const task of tasks) {
      try {
        const result = await verifySubmittedTask(task.id);

        results.push({
          taskId: task.id,
          title: task.title,
          verificationType: task.verificationType,
          ...(result.ok
            ? {
                status: result.status,
                verificationStatus: result.verificationStatus,
                passed: result.passed,
              }
            : {
                error: result.reason,
              }),
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "TASK_STATE_CHANGED"
        ) {
          results.push({
            taskId: task.id,
            title: task.title,
            error: "task_state_changed",
          });
          continue;
        }

        console.error(
          "Automatic verification failed",
          task.id,
          error
        );

        results.push({
          taskId: task.id,
          title: task.title,
          error: "verification_error",
        });
      }
    }

    return NextResponse.json({
      scanned: tasks.length,
      results,
    });
  } catch (error) {
    return apiError(error);
  }
}
