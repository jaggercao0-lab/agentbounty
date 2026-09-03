import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateAgentRequest } from "@/lib/agent-auth";
import { taskEventData } from "@/lib/task-events";
import { DELIVERY_TYPES, safeStringArray } from "@/lib/task-types";
import { isManagedArtifactUrl } from "@/lib/artifact-storage";
import { verifySubmittedTask } from "@/lib/verification/service";

const MAX_JSON_BYTES = 500_000;
const MAX_METADATA_BYTES = 64_000;

const schema = z.object({
  agentId: z.string().min(1).optional(),
  deliveryType: z.enum(DELIVERY_TYPES).optional(),
  pullRequestUrl: z.string().url().max(5000).optional(),
  artifactUrl: z.string().url().max(5000).optional(),
  textContent: z.string().max(200_000).optional(),
  jsonContent: z.union([
    z.string().max(MAX_JSON_BYTES),
    z.record(z.string(), z.unknown()),
    z.array(z.unknown()),
  ]).optional(),
  mimeType: z.string().trim().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
}).superRefine((value, ctx) => {
  if (
    value.jsonContent !== undefined &&
    typeof value.jsonContent !== "string"
  ) {
    const bytes = Buffer.byteLength(
      JSON.stringify(value.jsonContent),
      "utf8"
    );

    if (bytes > MAX_JSON_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["jsonContent"],
        message: "jsonContent is too large",
      });
    }
  }

  if (value.metadata) {
    const bytes = Buffer.byteLength(
      JSON.stringify(value.metadata),
      "utf8"
    );

    if (bytes > MAX_METADATA_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["metadata"],
        message: "metadata is too large",
      });
    }
  }
});

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function pullRequestMatchesRepository(
  value: string,
  repository: string | null
) {
  if (!repository) return false;

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return false;

  try {
    const url = new URL(value);
    const expectedPrefix = `/${owner}/${repo}/pull/`.toLowerCase();

    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "github.com" &&
      url.pathname.toLowerCase().startsWith(expectedPrefix) &&
      /^\d+\/?$/.test(
        url.pathname.slice(expectedPrefix.length)
      )
    );
  } catch {
    return false;
  }
}

function validateDelivery(
  deliveryType: string,
  data: z.infer<typeof schema>,
  githubRepo: string | null
) {
  switch (deliveryType) {
    case "PULL_REQUEST":
      if (!data.pullRequestUrl) {
        throw new Error("pull_request_url_required");
      }
      if (
        !pullRequestMatchesRepository(
          data.pullRequestUrl,
          githubRepo
        )
      ) {
        throw new Error("invalid_pull_request_url");
      }
      break;

    case "TEXT":
      if (!data.textContent?.trim()) {
        throw new Error("text_content_required");
      }
      break;

    case "FILE":
    case "URL":
      if (!data.artifactUrl) {
        throw new Error("artifact_url_required");
      }
      if (!isHttpsUrl(data.artifactUrl)) {
        throw new Error("https_artifact_url_required");
      }
      break;

    case "JSON":
      if (data.jsonContent === undefined) {
        throw new Error("json_content_required");
      }
      if (typeof data.jsonContent === "string") {
        try {
          JSON.parse(data.jsonContent);
        } catch {
          throw new Error("invalid_json_content");
        }
      }
      break;

    default:
      throw new Error("unsupported_delivery_type");
  }
}

function validVideoGenerationProof(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const proof = value as Record<string, unknown>;

  return (
    proof.attempted === true &&
    proof.ok === true &&
    typeof proof.provider === "string" &&
    typeof proof.model === "string" &&
    typeof proof.operationName === "string" &&
    typeof proof.sizeBytes === "number" &&
    proof.sizeBytes > 0
  );
}

async function verifyManagedVideoArtifact(url: string) {
  if (!isManagedArtifactUrl(url)) {
    throw new Error("video_artifact_must_use_managed_storage");
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: "HEAD",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("video_artifact_not_reachable");
  }

  if (!response.ok) {
    throw new Error("video_artifact_not_reachable");
  }

  const contentType = (response.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType && contentType !== "video/mp4") {
    throw new Error("video_artifact_content_type_mismatch");
  }

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isFinite(length) || length <= 0) {
      throw new Error("video_artifact_empty");
    }
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
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
    const data = schema.parse(await request.json());

    if (data.agentId && data.agentId !== agent.id) {
      return NextResponse.json(
        { error: "agent_id_mismatch" },
        { status: 403 }
      );
    }

    const task = await db.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
        workType: true,
        deliveryType: true,
        verificationType: true,
        requestedActionsJson: true,
        githubRepo: true,
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

    if (
      !["ASSIGNED", "WORKING", "REVISION"].includes(task.status)
    ) {
      return NextResponse.json(
        {
          error: "task_not_submittable",
          status: task.status,
        },
        { status: 409 }
      );
    }

    if (data.deliveryType && data.deliveryType !== task.deliveryType) {
      return NextResponse.json(
        {
          error: "delivery_type_mismatch",
          expected: task.deliveryType,
        },
        { status: 409 }
      );
    }

    validateDelivery(
      task.deliveryType,
      data,
      task.githubRepo
    );

    const requestedActions = safeStringArray(
      task.requestedActionsJson
    );

    if (requestedActions.includes("VIDEO_GENERATE")) {
      if (
        task.workType !== "VIDEO" ||
        task.deliveryType !== "FILE" ||
        data.mimeType !== "video/mp4"
      ) {
        throw new Error("invalid_video_delivery");
      }

      if (!data.artifactUrl) {
        throw new Error("artifact_url_required");
      }

      if (!validVideoGenerationProof(data.metadata?.videoGeneration)) {
        throw new Error("video_generation_proof_required");
      }

      await verifyManagedVideoArtifact(data.artifactUrl);
    }

    const normalizedJsonContent =
      data.jsonContent === undefined
        ? null
        : typeof data.jsonContent === "string"
          ? data.jsonContent
          : JSON.stringify(data.jsonContent);

    const submission = await db.$transaction(async tx => {
      const updated = await tx.task.updateMany({
        where: {
          id,
          assignedAgentId: agent.id,
          status: {
            in: ["ASSIGNED", "WORKING", "REVISION"],
          },
        },
        data: {
          status: "SUBMITTED",
        },
      });

      if (updated.count !== 1) {
        throw new Error("TASK_STATE_CHANGED");
      }

      const created = await tx.submission.create({
        data: {
          taskId: id,
          agentId: agent.id,
          deliveryType: task.deliveryType,
          pullRequestUrl: data.pullRequestUrl || null,
          artifactUrl: data.artifactUrl || null,
          textContent: data.textContent || null,
          jsonContent: normalizedJsonContent,
          mimeType: data.mimeType || null,
          metadataJson: data.metadata
            ? JSON.stringify(data.metadata)
            : null,
          notes: data.notes,
          verificationStatus:
            task.verificationType === "MANUAL"
              ? "PENDING"
              : null,
        },
      });

      await tx.taskEvent.create({
        data: taskEventData({
          taskId: id,
          type: "DELIVERY_SUBMITTED",
          actorType: "AGENT",
          actorId: agent.id,
          message: `${task.deliveryType} delivery submitted`,
          metadata: {
            submissionId: created.id,
            deliveryType: task.deliveryType,
            pullRequestUrl: created.pullRequestUrl,
            artifactUrl: created.artifactUrl,
            mimeType: created.mimeType,
            actions: requestedActions,
          },
          dedupeKey: `submission:${created.id}:submitted`,
        }),
      });

      return created;
    });

    let automaticVerification = null;

    if (
      task.deliveryType !== "PULL_REQUEST" &&
      ["AUTOMATIC", "HYBRID"].includes(task.verificationType)
    ) {
      try {
        const result = await verifySubmittedTask(id);

        automaticVerification = result.ok
          ? {
              status: result.status,
              verificationStatus: result.verificationStatus,
              passed: result.passed,
            }
          : {
              error: result.reason,
              status: result.status,
            };
      } catch (error) {
        console.error(
          "Immediate artifact verification failed",
          id,
          error
        );
      }
    }

    return NextResponse.json(
      {
        ...submission,
        automaticVerification,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TASK_STATE_CHANGED"
    ) {
      return NextResponse.json(
        { error: "task_not_submittable" },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      [
        "pull_request_url_required",
        "invalid_pull_request_url",
        "text_content_required",
        "artifact_url_required",
        "https_artifact_url_required",
        "json_content_required",
        "invalid_json_content",
        "unsupported_delivery_type",
        "invalid_video_delivery",
        "video_generation_proof_required",
        "video_artifact_must_use_managed_storage",
        "video_artifact_not_reachable",
        "video_artifact_content_type_mismatch",
        "video_artifact_empty",
      ].includes(error.message)
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return apiError(error);
  }
}
