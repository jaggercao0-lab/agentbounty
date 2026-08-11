import {
  NextResponse,
} from "next/server";

import {
  Prisma,
} from "@prisma/client";

import {
  z,
} from "zod";

import {
  db,
} from "@agentbounty/database";

import {
  verifyAgentToken,
} from "@/lib/agent-auth";

import {
  apiError,
} from "@/lib/http";

const schema =
  z.object({
    agentId:
      z.string().min(1),

    priceCents:
      z.number()
        .int()
        .positive(),

    message:
      z.string()
        .max(1000)
        .optional(),
  });

export async function POST(
  request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        id: string;
      }>;
  }
) {
  try {
    const { id } =
      await params;

    const data =
      schema.parse(
        await request.json()
      );

    const authorized =
      await verifyAgentToken(
        request,
        data.agentId
      );

    if (!authorized) {
      return NextResponse.json(
        {
          error:
            "invalid_agent_token",
        },
        {
          status: 401,
        }
      );
    }

    const task =
      await db.task.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          status: true,
        },
      });

    if (
      !task ||
      task.status !== "OPEN"
    ) {
      return NextResponse.json(
        {
          error:
            "task_not_open",
        },
        {
          status: 409,
        }
      );
    }

    const agent =
      await db.agent.findFirst({
        where: {
          id:
            data.agentId,

          archivedAt:
            null,
        },

        select: {
          id: true,
        },
      });

    if (!agent) {
      return NextResponse.json(
        {
          error:
            "agent_not_found",
        },
        {
          status: 404,
        }
      );
    }

    const existing =
      await db.bid.findUnique({
        where: {
          taskId_agentId: {
            taskId: id,
            agentId:
              data.agentId,
          },
        },
      });

    if (existing) {
      return NextResponse.json({
        ...existing,
        alreadyExists:
          true,
      });
    }

    try {
      const bid =
        await db.bid.create({
          data: {
            taskId: id,
            agentId:
              data.agentId,
            priceCents:
              data.priceCents,
            message:
              data.message,
          },
        });

      return NextResponse.json(
        {
          ...bid,
          alreadyExists:
            false,
        },
        {
          status: 201,
        }
      );
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing =
          await db.bid.findUnique({
            where: {
              taskId_agentId: {
                taskId: id,
                agentId:
                  data.agentId,
              },
            },
          });

        if (existing) {
          return NextResponse.json({
            ...existing,
            alreadyExists:
              true,
          });
        }
      }

      throw error;
    }
  } catch (e) {
    return apiError(e);
  }
}
