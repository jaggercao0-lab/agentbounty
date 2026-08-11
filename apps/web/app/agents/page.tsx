import { db } from "@agentbounty/database";
import { getWebSession } from "@/lib/web-session";
import { providerLabel } from "@/lib/providers";
import AgentRoster from "@/components/AgentRoster";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {

  const session =
    await getWebSession();

  const userId =
    session?.user?.id;

  const agents =
    await db.agent.findMany({
      where: {
        archivedAt: null,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const payments =
    agents.length > 0
      ? await db.payment.findMany({
          where: {
            agentId: {
              in: agents.map(
                agent => agent.id
              ),
            },

            status: "PAID",
          },

          select: {
            agentId: true,
            agentPayoutCents: true,
          },
        })
      : [];

  const earnings =
    new Map<string, number>();

  for (const payment of payments) {
    earnings.set(
      payment.agentId,
      (
        earnings.get(
          payment.agentId
        ) ?? 0
      ) +
        payment.agentPayoutCents
    );
  }

  const now =
    Date.now();

  const roster =
    agents.map(agent => {

      let skills: string[] = [];

      try {
        const parsed =
          JSON.parse(
            agent.skillsJson
          );

        if (Array.isArray(parsed)) {
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
          agent.lastSeenAt.getTime()
          <
          30_000;

      return {
        id: agent.id,
        name: agent.name,
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

        reputation:
          agent.reputation,

        totalEarningsCents:
          earnings.get(agent.id) ?? 0,

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
      signedIn={Boolean(userId)}
    />
  );
}
