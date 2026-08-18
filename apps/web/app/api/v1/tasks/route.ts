import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import { authenticateAgentRequest } from "@/lib/agent-auth";
import {
  DELIVERY_TYPES,
  SOURCE_TYPES,
  VERIFICATION_TYPES,
  WORK_TYPES,
  DEFAULT_DELIVERY_BY_WORK,
  DEFAULT_VERIFICATION_BY_WORK,
  requiredCapabilitiesFor,
  hasRequiredCapabilities,
  isSafeExternalSourceUrl,
} from "@/lib/task-types";

const githubRepo = z
  .string()
  .trim()
  .regex(
    /^[^/\s]+\/[^/\s]+$/,
    "githubRepo must use owner/repository format"
  );

function parseGitHubIssueUrl(value: string) {
  const match = value.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/i
  );

  if (!match) return null;

  return {
    repository: `${match[1]}/${match[2]}`,
    issueNumber: Number(match[3]),
  };
}

const createTask = z
  .object({
    title: z.string().trim().min(3),
    description: z.string().trim().min(3),
    workType: z.enum(WORK_TYPES).default("CODE"),
    sourceType: z.enum(SOURCE_TYPES).default("MANUAL"),
    sourceUrl: z.string().url().optional().nullable(),
    sourceData: z.record(z.string(), z.unknown()).optional(),
    deliveryType: z.enum(DELIVERY_TYPES).optional(),
    verificationType: z.enum(VERIFICATION_TYPES).optional(),
    requiredCapabilities: z.array(z.string().trim().min(1)).max(12).optional(),
    githubRepo: githubRepo.optional().nullable(),
    githubIssueUrl: z.string().url().optional().nullable(),
    bountyCents: z.number().int().positive(),
    executionFeeCents: z.number().int().nonnegative(),
    includedRevisions: z.number().int().min(0).max(5).default(1),
    acceptanceCriteria: z.array(z.string().trim().min(2)).min(1),
  })
  .superRefine((value, ctx) => {
    const deliveryType =
      value.deliveryType || DEFAULT_DELIVERY_BY_WORK[value.workType];
    const verificationType =
      value.verificationType || DEFAULT_VERIFICATION_BY_WORK[value.workType];

    if (value.executionFeeCents >= value.bountyCents) {
      ctx.addIssue({
        code: "custom",
        path: ["executionFeeCents"],
        message: "executionFeeCents must be smaller than bountyCents",
      });
    }

    if (value.workType === "CODE" && !value.githubRepo) {
      ctx.addIssue({
        code: "custom",
        path: ["githubRepo"],
        message: "Code tasks require a GitHub repository",
      });
    }

    if (value.sourceType === "GITHUB_ISSUE") {
      if (!value.githubIssueUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["githubIssueUrl"],
          message: "GitHub Issue source requires githubIssueUrl",
        });
      } else {
        const issue = parseGitHubIssueUrl(value.githubIssueUrl);

        if (!issue) {
          ctx.addIssue({
            code: "custom",
            path: ["githubIssueUrl"],
            message: "githubIssueUrl must be a github.com Issue URL",
          });
        } else if (
          value.githubRepo &&
          issue.repository.toLowerCase() !== value.githubRepo.toLowerCase()
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["githubIssueUrl"],
            message: "GitHub Issue must belong to githubRepo",
          });
        }
      }
    }

    if (["URL", "FILE", "API"].includes(value.sourceType)) {
      if (!value.sourceUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceUrl"],
          message: `${value.sourceType} source requires sourceUrl`,
        });
      } else if (!isSafeExternalSourceUrl(value.sourceUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceUrl"],
          message:
            "sourceUrl must be a public HTTPS URL and cannot target localhost or a private IP",
        });
      }
    }

    if (deliveryType === "PULL_REQUEST" && !value.githubRepo) {
      ctx.addIssue({
        code: "custom",
        path: ["githubRepo"],
        message: "Pull request delivery requires a GitHub repository",
      });
    }

    if (verificationType === "GITHUB" && deliveryType !== "PULL_REQUEST") {
      ctx.addIssue({
        code: "custom",
        path: ["verificationType"],
        message: "GitHub verification requires pull request delivery",
      });
    }
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedWorkType = url.searchParams.get("workType");

  const workType = WORK_TYPES.includes(requestedWorkType as any)
    ? (requestedWorkType as (typeof WORK_TYPES)[number])
    : null;

  const agent = request.headers.get("x-api-key")
    ? await authenticateAgentRequest(request)
    : null;

  const tasks = await db.task.findMany({
    where: {
      status: "OPEN",
      ...(workType ? { workType } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const visibleTasks = agent
    ? tasks.filter(task =>
        hasRequiredCapabilities(
          agent.capabilitiesJson,
          task.requiredCapabilitiesJson
        )
      )
    : tasks;

  return NextResponse.json({
    tasks: visibleTasks.map(task => {
      const {
        acceptanceCriteriaJson,
        requiredCapabilitiesJson,
        sourceDataJson: _sourceDataJson,
        sourceUrl: _sourceUrl,
        githubIssueUrl: _githubIssueUrl,
        ownerId: _ownerId,
        ...publicTask
      } = task;

      return {
        ...publicTask,
        acceptanceCriteria: JSON.parse(acceptanceCriteriaJson),
        requiredCapabilities: JSON.parse(requiredCapabilitiesJson),
        sourceAvailable:
          task.sourceType !== "MANUAL",
      };
    }),
  });
}

export async function POST(request: Request) {
  try {
    const user = await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const data = createTask.parse(await request.json());

    const deliveryType =
      data.deliveryType || DEFAULT_DELIVERY_BY_WORK[data.workType];
    const verificationType =
      data.verificationType || DEFAULT_VERIFICATION_BY_WORK[data.workType];
    const requiredCapabilities =
      data.requiredCapabilities?.length
        ? [...new Set(data.requiredCapabilities.map(value => value.toUpperCase()))]
        : requiredCapabilitiesFor(data.workType);

    const task = await db.task.create({
      data: {
        ownerId: user.id,
        title: data.title,
        description: data.description,
        workType: data.workType,
        sourceType: data.sourceType,
        sourceUrl: data.sourceUrl || null,
        sourceDataJson: data.sourceData
          ? JSON.stringify(data.sourceData)
          : null,
        deliveryType,
        verificationType,
        requiredCapabilitiesJson: JSON.stringify(requiredCapabilities),
        githubRepo: data.githubRepo || null,
        githubIssueUrl: data.githubIssueUrl || null,
        bountyCents: data.bountyCents,
        executionFeeCents: data.executionFeeCents,
        successRewardCents: data.bountyCents - data.executionFeeCents,
        includedRevisions: data.includedRevisions,
        acceptanceCriteriaJson: JSON.stringify(data.acceptanceCriteria),
        status: "OPEN",
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
