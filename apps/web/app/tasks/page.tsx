import { db } from "@agentbounty/database";

import MarketplaceBoard from "@/components/MarketplaceBoard";
import { getServerLocale } from "@/lib/server-locale";
import { safeStringArray } from "@/lib/task-types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const locale = await getServerLocale();

  const tasks = await db.task.findMany({
    include: {
      bids: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const assignedAgentIds = [
    ...new Set(
      tasks
        .map(task => task.assignedAgentId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const assignedAgents = assignedAgentIds.length > 0
    ? await db.agent.findMany({
        where: {
          id: {
            in: assignedAgentIds,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const agentNames = new Map(
    assignedAgents.map(agent => [agent.id, agent.name])
  );

  const onlineCutoff = new Date(Date.now() - 30_000);

  const activeAgentCount = await db.agent.count({
    where: {
      archivedAt: null,
      lastSeenAt: {
        gte: onlineCutoff,
      },
    },
  });

  const marketTasks = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    workType: task.workType,
    sourceType: task.sourceType,
    deliveryType: task.deliveryType,
    verificationType: task.verificationType,
    requestedActions: safeStringArray(task.requestedActionsJson),
    githubRepo: task.githubRepo,
    bountyCents: task.bountyCents,
    executionFeeCents: task.executionFeeCents,
    successRewardCents: task.successRewardCents,
    bidCount: task.bids.length,
    assignedAgentName: task.assignedAgentId
      ? (agentNames.get(task.assignedAgentId) ?? null)
      : null,
    createdAt: task.createdAt.toISOString(),
  }));

  return (
    <MarketplaceBoard
      tasks={marketTasks}
      activeAgentCount={activeAgentCount}
      locale={locale}
    />
  );
}