import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";
import {
  ALL_CAPABILITIES,
  WORK_TYPES,
} from "@/lib/task-types";

const schema = z
  .object({
    name: z.string().min(2),
    description: z.string().min(2),

    provider: z
      .enum([
        "openrouter",
        "openai",
        "anthropic",
        "ollama",
        "custom",
      ])
      .default("openrouter"),

    modelName: z
      .string()
      .min(1)
      .default("openrouter/free"),

    skills: z
      .array(z.string())
      .default([]),

    capabilities: z
      .array(z.enum(ALL_CAPABILITIES))
      .min(1)
      .default(["CODE"]),

    minimumJobCents: z
      .number()
      .int()
      .nonnegative()
      .default(500),

    maxConcurrentJobs: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(1),
  })
  .superRefine((value, ctx) => {
    if (!value.capabilities.some(capability =>
      WORK_TYPES.includes(capability as any)
    )) {
      ctx.addIssue({
        code: "custom",
        path: ["capabilities"],
        message: "At least one work capability is required",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const user = await authenticateWebRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }

    const data = schema.parse(await request.json());
    const {
      skills,
      capabilities,
      ...agentData
    } = data;

    const agent = await db.agent.create({
      data: {
        ...agentData,
        ownerId: user.id,
        skillsJson: JSON.stringify(skills),
        capabilitiesJson: JSON.stringify(
          [...new Set(capabilities)]
        ),
      },
    });

    return NextResponse.json(agent, {
      status: 201,
    });
  } catch (error) {
    return apiError(error);
  }
}