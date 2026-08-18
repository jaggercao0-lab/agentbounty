import {
  db,
} from "@agentbounty/database";

import {
  getWebSession,
} from "@/lib/web-session";

import {
  providerLabel,
} from "@/lib/providers";

import {
  calculateAgentReputation,
} from "@/lib/agent-reputation";

import { getServerLocale } from "@/lib/server-locale";
import AgentRoster from "@/components/AgentRoster";

export const dynamic =
  "force-dynamic";

export default async function AgentsPage() {
  const [session, locale] =
    await Promise.all([
      getWebSession(),
      getServerLocale(),
    ]);

  const userId =
    session?.user?.id;

  const agents =
    await db.agent.findMany({
      where: {
        archivedAt:
          null,
      },

      orderBy: {
        createdAt:
          "desc",
      },
    });

  const agentIds =
    agents.map(
      agent =>
        agent.id
    );

  const payments =
    agentIds.length > 0
      ? await db.payment.findMany({
          where: {
            agentId: {
              in:
                agentIds,
            },

            status:
              "PAID",
          },

          select: {
            agentId:
              true,

            agentPayoutCents:
              true,
          },
        })
      : [];

  const tasks =
    agentIds.length > 0
      ? await db.task.findMany({
          where: {
            assignedAgentId: {
              in:
                agentIds,
            },
          },

          select: {
            id:
              true,

            assignedAgentId:
              true,

            events: {
              select: {
                type:
                  true,

                createdAt:
                  true,
              },

              orderBy: {
                createdAt:
                  "asc",
              },
            },
          },
        })
      : [];

  const paymentsByAgent =
    new Map<
      string,
      {
        agentPayoutCents:
          number;
      }[]
    >();

  for (
    const payment
    of payments
  ) {
    const current =
      paymentsByAgent.get(
        payment.agentId
      ) ?? [];

    current.push({
      agentPayoutCents:
        payment.agentPayoutCents,
    });

    paymentsByAgent.set(
      payment.agentId,
      current
    );
  }

  const tasksByAgent =
    new Map<
      string,
      {
        id: string;

        events: {
          type: string;
          createdAt: Date;
        }[];
      }[]
    >();

  for (
    const task
    of tasks
  ) {
    if (
      !task.assignedAgentId
    ) {
      continue;
    }

    const current =
      tasksByAgent.get(
        task.assignedAgentId
      ) ?? [];

    current.push({
      id:
        task.id,

      events:
        task.events,
    });

    tasksByAgent.set(
      task.assignedAgentId,
      current
    );
  }

  const now =
    Date.now();

  const roster =
    agents.map(agent => {
      let skills:
        string[] = [];

      try {
        const parsed =
          JSON.parse(
            agent.skillsJson
          );

        if (
          Array.isArray(
            parsed
          )
        ) {
          skills =
            parsed.filter(
              item =>
                typeof item ===
                "string"
            );
        }
      } catch {
        skills = [];
      }

      const online =
        !!agent.lastSeenAt &&
        now -
          agent.lastSeenAt
            .getTime()
          <
          30_000;

      const agentPayments =
        paymentsByAgent.get(
          agent.id
        ) ?? [];

      const agentTasks =
        tasksByAgent.get(
          agent.id
        ) ?? [];

      const reputation =
        calculateAgentReputation(
          agentTasks,
          agentPayments
        );

      return {
        id:
          agent.id,

        name:
          agent.name,

        description:
          agent.description,

        provider:
          agent.provider,

        providerLabel:
          providerLabel(
            agent.provider
          ),

        modelName:
          agent.modelName,

        minimumJobCents:
          agent.minimumJobCents,

        maxConcurrentJobs:
          agent.maxConcurrentJobs,

        completedJobs:
          agent.completedJobs,

        reliabilityScore:
          reputation
            .reliabilityScore,

        successRate:
          reputation
            .successRate,

        firstPassSuccessRate:
          reputation
            .firstPassSuccessRate,

        revisionRate:
          reputation
            .revisionRate,

        trackedJobs:
          reputation
            .resolvedJobs,

        totalEarningsCents:
          reputation
            .totalEarningsCents,

        online,

        isOwner:
          userId ===
          agent.ownerId,

        skills,
      };
    });

  return (
    <AgentRoster
      agents={roster}
      signedIn={
        Boolean(userId)
      }
      locale={locale}
    />
  );
}
