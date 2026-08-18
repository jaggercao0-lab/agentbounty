import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";

const githubRepo = z
  .string()
  .trim()
  .regex(
    /^[^/\s]+\/[^/\s]+$/,
    "githubRepo must use owner/repository format"
  );

const createTask = z
  .object({
    title: z.string().min(3),
    description: z.string().min(3),
    githubRepo,
    githubIssueUrl: z
      .union([
        z.string().url(),
        z.literal(""),
      ])
      .optional()
      .default(""),
    bountyCents: z.number().int().positive(),
    executionFeeCents: z.number().int().nonnegative(),
    includedRevisions: z
      .number()
      .int()
      .min(0)
      .max(5)
      .default(1),
    acceptanceCriteria: z
      .array(z.string().min(2))
      .min(1),
  })
  .refine(
    x => x.executionFeeCents < x.bountyCents,
    {
      message:
        "executionFeeCents must be smaller than bountyCents",
    }
  );

export async function GET() {
  const tasks = await db.task.findMany({
    where: {
      status: "OPEN",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    tasks: tasks.map(task => {
      const {
        acceptanceCriteriaJson,
        ownerId: _ownerId,
        ...publicTask
      } = task;

      return {
        ...publicTask,
        acceptanceCriteria:
          JSON.parse(acceptanceCriteriaJson),
      };
    }),
  });
}

export async function POST(request: Request) {
  try {
    const user = await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        {
          error: "unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const data = createTask.parse(
      await request.json()
    );

    const {
      acceptanceCriteria,
      ...taskData
    } = data;

    const task = await db.task.create({
      data: {
        ...taskData,
        githubIssueUrl:
          data.githubIssueUrl || "",
        ownerId: user.id,
        successRewardCents:
          data.bountyCents - data.executionFeeCents,
        acceptanceCriteriaJson:
          JSON.stringify(acceptanceCriteria),
      },
    });

    return NextResponse.json(task, {
      status: 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
