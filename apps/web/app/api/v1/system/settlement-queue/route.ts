import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { verifyInternalRequest } from "@/lib/internal-auth";

export async function GET(
  request: Request
) {
  try {
    if (
      !process.env
        .AGENTBOUNTY_INTERNAL_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "internal_auth_not_configured",
        },
        { status: 503 }
      );
    }

    if (
      !verifyInternalRequest(request)
    ) {
      return NextResponse.json(
        {
          error: "unauthorized",
        },
        { status: 401 }
      );
    }

    const tasks =
      await db.task.findMany({
        where: {
          status: {
            in: [
              "SUBMITTED",
              "ACCEPTED",
            ],
          },
        },
        orderBy: {
          updatedAt: "asc",
        },
        select: {
          id: true,
          title: true,
          status: true,
          githubRepo: true,
          updatedAt: true,
        },
      });

    return NextResponse.json({
      tasks,
    });
  } catch (error) {
    return apiError(error);
  }
}
