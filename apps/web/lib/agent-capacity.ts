import { Prisma } from "@prisma/client";

// maxConcurrentJobs limits work that can require runner execution right now.
// SUBMITTED and VERIFYING are waiting on verification/owner review, so they do
// not consume an execution slot and must not prevent the Agent from taking new
// work. REVISION does consume a slot because the runner must execute again.
const ACTIVE_CAPACITY_STATES = [
  "ASSIGNED",
  "WORKING",
  "REVISION",
] as const;

export class AgentAtCapacityError extends Error {
  constructor() {
    super("AGENT_AT_CAPACITY");
    this.name = "AgentAtCapacityError";
  }
}

export async function assertAgentHasCapacity(
  tx: Prisma.TransactionClient,
  agentId: string
) {
  // Serialize assignment decisions for the same Agent so two owners cannot
  // concurrently hire past maxConcurrentJobs.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Agent" WHERE "id" = ${agentId} FOR UPDATE`
  );

  const agent = await tx.agent.findFirst({
    where: {
      id: agentId,
      archivedAt: null,
    },
    select: {
      maxConcurrentJobs: true,
    },
  });

  if (!agent) {
    throw new Error("AGENT_NOT_FOUND");
  }

  const activeJobs = await tx.task.count({
    where: {
      assignedAgentId: agentId,
      status: {
        in: [...ACTIVE_CAPACITY_STATES],
      },
    },
  });

  if (activeJobs >= agent.maxConcurrentJobs) {
    throw new AgentAtCapacityError();
  }
}
