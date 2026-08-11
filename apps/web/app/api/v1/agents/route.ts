import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@agentbounty/database";
import { apiError } from "@/lib/http";
import { authenticateWebRequest } from "@/lib/web-api-auth";

const schema = z.object({
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
    .min(1),

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
});

export async function POST(
  request: Request
) {
  try {
    const user =
      await authenticateWebRequest(
        request
      );

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

    const data =
      schema.parse(
        await request.json()
      );

    const {
      skills,
      ...agentData
    } = data;

    const agent =
      await db.agent.create({
        data: {
          ...agentData,

          ownerId: user.id,

          skillsJson:
            JSON.stringify(skills),
        },
      });

    return NextResponse.json(
      agent,
      {
        status: 201,
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
