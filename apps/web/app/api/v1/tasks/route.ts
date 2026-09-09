import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import { authenticateAgentRequest } from "@/lib/agent-auth";
import { taskEventData } from "@/lib/task-events";
import { artifactStorageConfigured } from "@/lib/artifact-storage";
import {
  ACTION_TYPES,
  DELIVERY_TYPES,
  SOURCE_TYPES,
  VERIFICATION_TYPES,
  WORK_TYPES,
  DEFAULT_DELIVERY_BY_WORK,
  DEFAULT_VERIFICATION_BY_WORK,
  requiredCapabilitiesFor,
  hasRequiredCapabilities,
  isSafeExternalSourceUrl,
  normalizeRequestedActions,
} from "@/lib/task-types";

const MAX_SOURCE_DATA_BYTES = 64_000;

const githubRepo = z
  .string()
  .trim()
  .regex(
    /^[^/\s]+\/[^/\s]+$/,
    "githubRepo must use owner/repository format"
  );

const videoSpecSchema = z
  .object({
    aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
    resolution: z.enum(["720p", "1080p", "4k"]).default("720p"),
    durationSeconds: z
      .union([z.literal(4), z.literal(6), z.literal(8)])
      .default(8),
  })
  .superRefine((value, ctx) => {
    if (
      ["1080p", "4k"].includes(value.resolution) &&
      value.durationSeconds !== 8
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["durationSeconds"],
        message: "1080p and 4k video generation require 8 seconds",
      });
    }
  });

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

function videoSpecFromSourceData(sourceData: Record<string, unknown> | undefined) {
  return videoSpecSchema.safeParse(sourceData?.video ?? {});
}

function publicExecutionSpec(
  workType: string,
  sourceDataJson: string | null
) {
  if (workType !== "VIDEO") return null;

  try {
    const parsed = sourceDataJson
      ? JSON.parse(sourceDataJson)
      : {};
    const result = videoSpecSchema.safeParse(
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>).video ?? {}
        : {}
    );

    return result.success
      ? { video: result.data }
      : null;
  } catch {
    return null;
  }
}

const createTask = z
  .object({
    title: z.string().trim().min(3).max(240),
    description: z.string().trim().min(3).max(20_000),
    workType: z.enum(WORK_TYPES).default("CODE"),
    sourceType: z.enum(SOURCE_TYPES).default("MANUAL"),
    sourceUrl: z.string().url().max(5000).optional().nullable(),
    sourceData: z.record(z.string(), z.unknown()).optional(),
    deliveryType: z.enum(DELIVERY_TYPES).optional(),
    verificationType: z.enum(VERIFICATION_TYPES).optional(),
    requestedActions: z.array(z.enum(ACTION_TYPES)).max(8).optional(),
    requiredCapabilities: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    githubRepo: githubRepo.optional().nullable(),
    githubIssueUrl: z.string().url().max(5000).optional().nullable(),
    bountyCents: z.number().int().positive().max(100_000_000),
    executionFeeCents: z.number().int().nonnegative(),
    includedRevisions: z.number().int().min(0).max(5).default(1),
    acceptanceCriteria: z
      .array(z.string().trim().min(2).max(1000))
      .min(1)
      .max(50),
  })
  .superRefine((value, ctx) => {
    const deliveryType =
      value.deliveryType || DEFAULT_DELIVERY_BY_WORK[value.workType];
    const verificationType =
      value.verificationType || DEFAULT_VERIFICATION_BY_WORK[value.workType];
    const requestedActions = value.requestedActions || [];

    if (
      requestedActions.includes("WEB_SEARCH") &&
      value.workType !== "RESEARCH"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedActions"],
        message: "WEB_SEARCH is currently supported only for RESEARCH tasks",
      });
    }

    if (
      requestedActions.includes("SOURCE_FETCH") &&
      !["URL", "FILE", "API"].includes(value.sourceType)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedActions"],
        message: "SOURCE_FETCH requires a URL, FILE or API source",
      });
    }

    if (
      requestedActions.includes("VIDEO_GENERATE") &&
      (value.workType !== "VIDEO" || deliveryType !== "FILE")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedActions"],
        message: "VIDEO_GENERATE requires VIDEO work with FILE delivery",
      });
    }

    if (value.workType === "VIDEO" && deliveryType !== "FILE") {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryType"],
        message: "VIDEO tasks currently require FILE delivery",
      });
    }

    if (value.workType === "VIDEO") {
      const result = videoSpecFromSourceData(value.sourceData);

      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: "custom",
            path: ["sourceData", "video", ...issue.path],
            message: issue.message,
          });
        }
      }
    }

    if (value.sourceData) {
      const bytes = Buffer.byteLength(
        JSON.stringify(value.sourceData),
        "utf8"
      );

      if (bytes > MAX_SOURCE_DATA_BYTES) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceData"],
          message: "sourceData is too large",
        });
      }
    }

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
  const generalProtocol = url.searchParams.get("protocol") === "0.4";
  const suppliedAgentToken = Boolean(
    request.headers.get("x-api-key")
  );

  const workType = WORK_TYPES.includes(requestedWorkType as any)
    ? (requestedWorkType as (typeof WORK_TYPES)[number])
    : null;

  const agent = suppliedAgentToken
    ? await authenticateAgentRequest(request)
    : null;

  if (suppliedAgentToken && !agent) {
    return NextResponse.json(
      { error: "invalid_agent_token" },
      { status: 401 }
    );
  }

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
        ) &&
        (
          generalProtocol ||
          (
            task.workType === "CODE" &&
            task.deliveryType === "PULL_REQUEST" &&
            ["MANUAL", "GITHUB_ISSUE"].includes(
              task.sourceType
            )
          )
        )
      )
    : tasks;

  return NextResponse.json({
    protocolVersion: generalProtocol ? "0.4" : "0.3",
    tasks: visibleTasks.map(task => {
      const executionSpec = publicExecutionSpec(
        task.workType,
        task.sourceDataJson
      );
      const {
        acceptanceCriteriaJson,
        requestedActionsJson,
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
        requestedActions: JSON.parse(requestedActionsJson),
        requiredCapabilities: JSON.parse(requiredCapabilitiesJson),
        executionSpec,
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

    if (data.workType === "VIDEO" && !artifactStorageConfigured()) {
      return NextResponse.json(
        { error: "video_artifact_storage_unavailable" },
        { status: 503 }
      );
    }

    const deliveryType =
      data.deliveryType || DEFAULT_DELIVERY_BY_WORK[data.workType];
    const verificationType =
      data.verificationType || DEFAULT_VERIFICATION_BY_WORK[data.workType];
    const requestedActions = normalizeRequestedActions([
      ...(data.requestedActions || []),
      ...(["URL", "FILE", "API"].includes(data.sourceType)
        ? ["SOURCE_FETCH"]
        : []),
      ...(data.workType === "VIDEO" && deliveryType === "FILE"
        ? ["VIDEO_GENERATE"]
        : []),
    ]);
    const requiredCapabilities = [
      ...new Set([
        ...requiredCapabilitiesFor(data.workType, requestedActions),
        ...(data.requiredCapabilities || []).map(value => value.toUpperCase()),
      ]),
    ];
    const normalizedSourceData = data.workType === "VIDEO"
      ? {
          ...(data.sourceData || {}),
          video: videoSpecSchema.parse(data.sourceData?.video ?? {}),
        }
      : data.sourceData;

    const task = await db.$transaction(async tx => {
      const created = await tx.task.create({
        data: {
          ownerId: user.id,
          title: data.title,
          description: data.description,
          workType: data.workType,
          sourceType: data.sourceType,
          sourceUrl: data.sourceUrl || null,
          sourceDataJson: normalizedSourceData
            ? JSON.stringify(normalizedSourceData)
            : null,
          deliveryType,
          verificationType,
          requestedActionsJson: JSON.stringify(requestedActions),
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

      await tx.taskEvent.create({
        data: taskEventData({
          taskId: created.id,
          type: "CONTRACT_PUBLISHED",
          actorType: "HUMAN",
          actorId: user.id,
          message: "Task published",
          metadata: {
            workType: data.workType,
            sourceType: data.sourceType,
            deliveryType,
            verificationType,
            requestedActions,
            githubRepo: data.githubRepo || null,
            sourceUrl: data.sourceUrl || null,
            video:
              data.workType === "VIDEO"
                ? (normalizedSourceData as { video: unknown }).video
                : null,
            bountyCents: data.bountyCents,
            executionFeeCents: data.executionFeeCents,
            successRewardCents:
              data.bountyCents - data.executionFeeCents,
          },
          dedupeKey: `task:${created.id}:published`,
        }),
      });

      return created;
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
