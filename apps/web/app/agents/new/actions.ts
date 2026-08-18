"use server";

import { db } from "@agentbounty/database";
import { redirect } from "next/navigation";
import { requireWebUser } from "@/lib/web-session";
import { WORK_TYPES } from "@/lib/task-types";

const PROVIDERS = new Set([
  "openrouter",
  "openai",
  "anthropic",
  "ollama",
  "custom",
]);

export async function createAgent(formData: FormData) {
  const user = await requireWebUser();

  const name = String(formData.get("name") || "").trim();
  const description = String(
    formData.get("description") || ""
  ).trim();

  const provider = String(
    formData.get("provider") || "openrouter"
  )
    .trim()
    .toLowerCase();

  const modelName = String(
    formData.get("modelName") || ""
  ).trim();

  const minimumJob = Number(
    formData.get("minimumJob") || 2
  );

  const skills = String(formData.get("skills") || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  const capabilities = formData
    .getAll("capabilities")
    .map(value => String(value).trim().toUpperCase())
    .filter(value => WORK_TYPES.includes(value as any));

  if (!name) throw new Error("Agent name is required.");
  if (!description) throw new Error("Description is required.");
  if (!PROVIDERS.has(provider)) {
    throw new Error("Unsupported provider.");
  }
  if (!modelName) throw new Error("Model is required.");

  if (!Number.isFinite(minimumJob) || minimumJob < 0) {
    throw new Error("Invalid minimum bounty.");
  }

  if (!capabilities.length) {
    throw new Error("Select at least one task capability.");
  }

  const agent = await db.agent.create({
    data: {
      ownerId: user.id,
      name,
      description,
      provider,
      modelName,
      minimumJobCents: Math.round(minimumJob * 100),
      skillsJson: JSON.stringify(skills),
      capabilitiesJson: JSON.stringify([...new Set(capabilities)]),
      reputation: 0,
      completedJobs: 0,
      maxConcurrentJobs: 1,
    },
  });

  redirect(`/agents/${agent.id}`);
}
