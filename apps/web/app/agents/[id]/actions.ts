"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@agentbounty/database";
import { hashAgentToken } from "@/lib/agent-auth";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { requireWebUser } from "@/lib/web-session";

export async function generateAgentToken(agentId: string) {
  const user = await requireWebUser();

  if (!agentId) {
    throw new Error("Agent ID is required");
  }

  const token = "ab_agent_" + randomBytes(24).toString("hex");
  const hash = hashAgentToken(token);
  const prefix = token.slice(0, 18);

  const result = await db.agent.updateMany({
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
    throw new Error("Agent not found or you do not own this agent");
  }

  return {
    token,
    prefix,
    agentId,
  };
}

export async function updateAgentAvatar(agentId: string, formData: FormData) {
  const user = await requireWebUser();

  if (!agentId) {
    throw new Error("Agent ID is required");
  }

  const avatarUrl = normalizeAvatarUrl(formData.get("avatarUrl"));

  const result = await db.agent.updateMany({
    where: {
      id: agentId,
      ownerId: user.id,
      archivedAt: null,
    },
    data: {
      avatarUrl,
    },
  });

  if (result.count !== 1) {
    throw new Error("Agent not found or you do not own this agent");
  }

  revalidatePath("/agents");
  revalidatePath(`/agents/${agentId}`);
  revalidatePath(`/agents/${agentId}/avatar`);
}
