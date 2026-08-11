import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";

const schema = z.object({
  ciPassed: z.boolean(),
  acceptancePassed: z.boolean(),
  notes: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user =
      await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const data =
      schema.parse(await request.json());

    const task = await db.task.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "task_not_found" },
        { status: 404 }
      );
    }

    if (task.status !== "SUBMITTED") {
      return NextResponse.json(
        {
          error: "task_not_submitted",
          status: task.status,
        },
        { status: 409 }
      );
    }

    const latestSubmission =
      await db.submission.findFirst({
        where: { taskId: id },
        orderBy: { createdAt: "desc" },
      });

    if (!latestSubmission) {
      return NextResponse.json(
        { error: "submission_not_found" },
        { status: 404 }
      );
    }

    const passed =
      data.ciPassed &&
      data.acceptancePassed;

    const result =
      await db.$transaction(async (tx) => {
        await tx.submission.update({
          where: {
            id: latestSubmission.id,
          },
          data: {
            ciPassed: data.ciPassed,
            verifiedAt: new Date(),
          },
        });

        if (passed) {
          return tx.task.update({
            where: { id },
            data: {
              status: "ACCEPTED",
            },
          });
        }

        if (
          task.revisionCount <
          task.includedRevisions
        ) {
          return tx.task.update({
            where: { id },
            data: {
              status: "REVISION",
              revisionCount: {
                increment: 1,
              },
            },
          });
        }

        return tx.task.update({
          where: { id },
          data: {
            status: "CANCELLED",
          },
        });
      });

    return NextResponse.json({
      passed,
      task: result,
    });
  } catch (error) {
    return apiError(error);
  }
}
