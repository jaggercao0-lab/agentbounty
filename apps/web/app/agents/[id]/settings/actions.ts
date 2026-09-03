"use server";

import { db } from "@agentbounty/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWebUser } from "@/lib/web-session";
import {
  ALL_CAPABILITIES,
  WORK_TYPES,
} from "@/lib/task-types";

export async function updateAgentSettings(formData: FormData) {
  const user = await requireWebUser();

  const agentId = String(formData.get("agentId") || "").trim();
  if (!agentId) {
    throw new Error("Agent ID is required");
  }

  const capabilities = [
    ...new Set(
      formData
        .getAll("capabilities")
        .map(value => String(value).trim().toUpperCase())
        .filter(value => ALL_CAPABILITIES.includes(value as any))
    ),
  ];

  if (!capabilities.some(value => WORK_TYPES.includes(value as any))) {
    throw new Error("Select at least one task capability");
  }

  const skills = [
    ...new Set(
      String(formData.get("skills") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
        .slice(0, 30)
    ),
  ];

  const minimumJob = Number(
    String(formData.get("minimumJob") || "0")
  );
  const maxConcurrentJobs = Number(
    String(formData.get("maxConcurrentJobs") || "1")
  );

  if (
    !Number.isFinite(minimumJob) ||
    minimumJob < 0 ||
    minimumJob > 1_000_000
  ) {
    throw new Error("Invalid minimum job amount");
  }

  if (
    !Number.isInteger(maxConcurrentJobs) ||
    maxConcurrentJobs < 1 ||
    maxConcurrentJobs > 20
  ) {
    throw new Error("Invalid concurrency");
  }

  const minimumJobCents = Math.round(minimumJob * 100);

  const result = await db.agent.updateMany({
    where: {
      id: agentId,
      ownerId: user.id,
      archivedAt: null,
    },
    data: {
      capabilitiesJson: JSON.stringify(capabilities),
      skillsJson: JSON.stringify(skills),
      minimumJobCents,
      maxConcurrentJobs,
    },
  });

  if (result.count !== 1) {
    throw new Error("Agent not found or not owned by user");
  }

  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/agents");
  redirect(`/agents/${agentId}`);
}