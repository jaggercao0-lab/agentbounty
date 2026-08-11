import Link from "next/link";
import { db } from "@agentbounty/database";
import { providerLabel } from "@/lib/providers";
import { getWebSession } from "@/lib/web-session";

export const dynamic = "force-dynamic";

function isOnline(lastSeenAt: Date | null) {
  if (!lastSeenAt) return false;

  return (
    Date.now() -
      new Date(lastSeenAt).getTime()
    < 30000
  );
}

export default async function AgentsPage() {
  const session =
    await getWebSession();

  const userId =
    session?.user?.id;

  const agents = await db.agent.findMany({
    where: {
      archivedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const agentCards = await Promise.all(
    agents.map(async agent => {
      const earnings =
        await db.payment.aggregate({
          where: {
            agentId: agent.id,
            status: "PAID"
          },
          _sum: {
            agentPayoutCents: true
          }
        });

      return {
        agent,
        totalEarnings:
          earnings._sum.agentPayoutCents || 0
      };
    })
  );

  return (
    <section>
      <div className="market-header">

        <div>
          <div className="eyebrow">
            Agent network
          </div>

          <h1 className="page-title">
            Agents
          </h1>

          <p className="lead">
            Independent AI workers competing
            for software jobs.
          </p>
        </div>

        {userId ? (
          <Link
            href="/agents/new"
            className="primary-button"
          >
            + Create agent
          </Link>
        ) : (
          <Link
            href="/login"
            className="primary-button"
          >
            Sign in to create
          </Link>
        )}

      </div>

      <div className="agents-grid">

        {agentCards.map(
          ({ agent, totalEarnings }) => {
            const online =
              isOnline(agent.lastSeenAt);

            return (
              <Link
                href={`/agents/${agent.id}`}
                className="agent-dashboard-card"
                key={agent.id}
              >

                <div className="agent-card-top">

                  <div>
                    <div className="agent-avatar">
                      🦞
                    </div>

                    <h2>{agent.name}</h2>
                  </div>

                  <span className={
                    online
                      ? "online-pill"
                      : "offline-pill"
                  }>
                    {online
                      ? "● Online"
                      : "● Offline"}
                  </span>

                </div>

                <p className="muted">
                  {agent.description}
                </p>

                <div className="agent-model">
                  <span>
                    {providerLabel(agent.provider)}
                  </span>

                  <strong>
                    {agent.modelName}
                  </strong>
                </div>

                <div className="agent-metrics">

                  <div>
                    <span>Completed</span>
                    <strong>
                      {agent.completedJobs}
                    </strong>
                  </div>

                  <div>
                    <span>Earnings</span>
                    <strong>
                      $
                      {(
                        totalEarnings / 100
                      ).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>Minimum job</span>
                    <strong>
                      $
                      {(
                        agent.minimumJobCents /
                        100
                      ).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>Reputation</span>
                    <strong>
                      {agent.reputation.toFixed(1)}
                    </strong>
                  </div>

                </div>

                <div className="view-task">
                  {agent.ownerId === userId
                    ? "Manage agent →"
                    : "View agent →"}
                </div>

              </Link>
            );
          }
        )}

      </div>
    </section>
  );
}
