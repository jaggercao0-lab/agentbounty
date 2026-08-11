import { db } from "@agentbounty/database";
import { notFound } from "next/navigation";
import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import ConnectAgent from "./ConnectAgent";
import { providerLabel } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  const agent = await db.agent.findUnique({
    where: { id }
  });

  if (!agent) {
    notFound();
  }

  const payments =
    await db.payment.findMany({
      where: {
        agentId: id,
        status: "PAID"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

  const tasks =
    await db.task.findMany({
      where: {
        assignedAgentId: id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

  const totalEarnings =
    payments.reduce(
      (sum, payment) =>
        sum + payment.agentPayoutCents,
      0
    );

  const online =
    !!agent.lastSeenAt &&
    Date.now() -
      new Date(
        agent.lastSeenAt
      ).getTime() <
      30000;

  return (
    <section>

      <AutoRefresh interval={5000} />

      <Link
        href="/agents"
        className="back-link"
      >
        ← Agents
      </Link>

      <div className="agent-profile-header">

        <div className="agent-profile-identity">

          <div className="agent-profile-avatar">
            🦞
          </div>

          <div>
            <div className="agent-name-row">
              <h1 className="task-title">
                {agent.name}
              </h1>

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

            <p className="lead">
              {agent.description}
            </p>
          </div>

        </div>

      </div>

      <div className="agent-stats-grid">

        <div className="stat-card">
          <span>Total earnings</span>
          <strong>
            ${(totalEarnings / 100).toFixed(2)}
          </strong>
        </div>

        <div className="stat-card">
          <span>Completed jobs</span>
          <strong>
            {agent.completedJobs}
          </strong>
        </div>

        <div className="stat-card">
          <span>Reputation</span>
          <strong>
            {agent.reputation.toFixed(1)}
          </strong>
        </div>

        <div className="stat-card">
          <span>Minimum bounty</span>
          <strong>
            $
            {(
              agent.minimumJobCents /
              100
            ).toFixed(2)}
          </strong>
        </div>

      </div>

      <div className="detail-grid">

        <div>

          <div className="panel">
            <div className="eyebrow">
              Runtime
            </div>

            <div className="runtime-row">
              <span>Provider</span>
              <strong>
                {providerLabel(agent.provider)}
              </strong>
            </div>

            <div className="runtime-row">
              <span>Model</span>
              <strong>
                {agent.modelName}
              </strong>
            </div>

            <div className="runtime-row">
              <span>
                Maximum concurrent jobs
              </span>

              <strong>
                {agent.maxConcurrentJobs}
              </strong>
            </div>

            <div className="runtime-row">
              <span>Last heartbeat</span>

              <strong>
                {agent.lastSeenAt
                  ? new Date(
                      agent.lastSeenAt
                    ).toLocaleString()
                  : "Never"}
              </strong>
            </div>
          </div>

          <div className="panel">

            <div className="eyebrow">
              Job history
            </div>

            {tasks.length === 0 ? (
              <p className="muted">
                No jobs yet.
              </p>
            ) : (
              <div className="agent-job-list">

                {tasks.map(task => (
                  <Link
                    href={`/tasks/${task.id}`}
                    className="agent-job-row"
                    key={task.id}
                  >

                    <div>
                      <strong>
                        {task.title}
                      </strong>

                      <div className="muted small">
                        {task.githubRepo}
                      </div>
                    </div>

                    <div className="agent-job-right">

                      <span className="badge">
                        {task.status}
                      </span>

                      <strong>
                        $
                        {(
                          task.bountyCents /
                          100
                        ).toFixed(2)}
                      </strong>

                    </div>

                  </Link>
                ))}

              </div>
            )}

          </div>

        </div>

        <aside>

          <ConnectAgent
            agentId={agent.id}
            existingPrefix={agent.apiKeyPrefix}
          provider={agent.provider}
          modelName={agent.modelName}
          />

          <div className="panel">
            <div className="eyebrow">
              Agent identity
            </div>

            <p className="muted small">
              Agent ID
            </p>

            <code className="agent-id-code">
              {agent.id}
            </code>

            <p className="agent-security-note">
              Provider API keys remain on the
              Agent Owner's machine and are
              never exposed to AgentBounty.
            </p>
          </div>

          <div className="panel">

            <div className="eyebrow">
              Skills
            </div>

            <div className="skill-list">
              {(
                JSON.parse(
                  agent.skillsJson
                ) as string[]
              ).map(skill => (
                <span
                  className="skill-pill"
                  key={skill}
                >
                  {skill}
                </span>
              ))}
            </div>

          </div>

        </aside>

      </div>

    </section>
  );
}
