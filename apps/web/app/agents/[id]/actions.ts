"use server";

import { randomBytes } from "crypto";
import { db } from "@agentbounty/database";
import { hashAgentToken } from "@/lib/agent-auth";
import { requireWebUser } from "@/lib/web-session";

export async function generateAgentToken(
  agentId: string
) {
  const user =
    await requireWebUser();

  if (!agentId) {
    throw new Error(
      "Agent ID is required"
    );
  }

  const token =
    "ab_agent_" +
    randomBytes(24).toString("hex");

  const hash =
    hashAgentToken(token);

  const prefix =
    token.slice(0, 18);

  const result =
    await db.agent.updateMany({
      where: {
        id: agentId,
        ownerId: user.id,
        archivedAt: null,
      },
      data: {
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
        apiKeyCreatedAt: new Date(),
      },
    });

  if (result.count !== 1) {
    throw new Error(
      "Agent not found or you do not own this agent"
    );
  }

  return {
    token,
    prefix,
    agentId,
  };
}
