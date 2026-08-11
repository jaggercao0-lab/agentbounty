import { db } from "@agentbounty/database";
import { notFound } from "next/navigation";
import Link from "next/link";

import AutoRefresh from "@/components/AutoRefresh";
import ConnectAgent from "./ConnectAgent";

import { providerLabel } from "@/lib/providers";
import { getWebSession } from "@/lib/web-session";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function workerMessage(
  online: boolean,
  completedJobs: number,
  name: string
) {
  if (!online) {
    return `${name} is currently sleeping. probably dreaming about pull requests.`;
  }

  if (completedJobs === 0) {
    return `${name} is awake and waiting for its first contract.`;
  }

  return `${name} is online and listening to the contract feed...`;
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session =
    await getWebSession();

  const agent =
    await db.agent.findUnique({
      where: {
        id,
      },
    });

  if (!agent) {
    notFound();
  }

  const isOwner =
    session?.user?.id ===
    agent.ownerId;

  const payments =
    await db.payment.findMany({
      where: {
        agentId: id,
        status: "PAID",
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const tasks =
    await db.task.findMany({
      where: {
        assignedAgentId: id,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const totalEarnings =
    payments.reduce(
      (sum, payment) =>
        sum +
        payment.agentPayoutCents,
      0
    );

  const online =
    Boolean(agent.lastSeenAt) &&
    Date.now() -
      new Date(
        agent.lastSeenAt!
      ).getTime() <
      30_000;

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

  return (
    <div className="ab-worker-page">

      <AutoRefresh interval={5000} />

      <div className="ab-worker-bg">
        <div className="ab-worker-grid" />
        <div className="ab-worker-glow" />
      </div>

      <div className="ab-worker-inner">

        <div className="ab-worker-topbar">

          <Link
            href="/agents"
            className="ab-worker-back"
          >
            ← MACHINE WORKFORCE
          </Link>

          <span className="ab-worker-id">
            WORKER
            {" "}
            {agent.id
              .slice(-8)
              .toUpperCase()}
          </span>

        </div>

        <header className="ab-worker-header">

          <div className="ab-worker-identity">

            <div className="ab-worker-avatar-large">
              {agent.name
                .slice(0, 2)
                .toUpperCase()}

              <span
                className={
                  online
                    ? "ab-worker-avatar-signal ab-worker-avatar-online"
                    : "ab-worker-avatar-signal"
                }
              />
            </div>

            <div className="ab-worker-heading">

              <div className="ab-worker-status-row">

                <span
                  className={
                    online
                      ? "ab-worker-presence ab-worker-presence-online"
                      : "ab-worker-presence ab-worker-presence-offline"
                  }
                >
                  <i />

                  {online
                    ? "ONLINE"
                    : "OFFLINE"}
                </span>

                {isOwner && (
                  <span className="ab-worker-owner-chip">
                    YOUR WORKER
                  </span>
                )}

                <span className="ab-worker-provider-chip">
                  {providerLabel(
                    agent.provider
                  )}
                </span>

              </div>

              <h1>
                {agent.name}
              </h1>

              <p>
                {agent.description}
              </p>

              <div className="ab-worker-terminal-line">
                <span>&gt;_</span>

                {workerMessage(
                  online,
                  agent.completedJobs,
                  agent.name
                )}
              </div>

            </div>

          </div>

        </header>

        <section className="ab-worker-stats">

          <div>
            <span>
              TOTAL EARNINGS
            </span>

            <strong>
              {money(
                totalEarnings
              )}
            </strong>

            <small>
              simulated payout
            </small>
          </div>

          <div>
            <span>
              JOBS COMPLETED
            </span>

            <strong>
              {agent.completedJobs}
            </strong>

            <small>
              verified deliveries
            </small>
          </div>

          <div>
            <span>
              REPUTATION
            </span>

            <strong>
              {agent.reputation.toFixed(
                1
              )}
            </strong>

            <small>
              worker score
            </small>
          </div>

          <div>
            <span>
              MINIMUM JOB
            </span>

            <strong>
              {money(
                agent.minimumJobCents
              )}
            </strong>

            <small>
              bid threshold
            </small>
          </div>

        </section>

        <div className="ab-worker-layout">

          <main className="ab-worker-main">

            <section className="ab-worker-panel">

              <div className="ab-worker-panel-head">

                <div>
                  <span>
                    RUNTIME PROFILE
                  </span>

                  <h2>
                    Machine configuration
                  </h2>
                </div>

                <span className="ab-worker-runtime-state">
                  {online
                    ? "SIGNAL ACTIVE"
                    : "NO HEARTBEAT"}
                </span>

              </div>

              <div className="ab-worker-runtime-grid">

                <div>
                  <span>
                    PROVIDER
                  </span>

                  <strong>
                    {providerLabel(
                      agent.provider
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    MODEL
                  </span>

                  <strong>
                    {agent.modelName}
                  </strong>
                </div>

                <div>
                  <span>
                    MAX CONCURRENCY
                  </span>

                  <strong>
                    {agent.maxConcurrentJobs}
                    {" "}
                    job
                    {agent.maxConcurrentJobs ===
                    1
                      ? ""
                      : "s"}
                  </strong>
                </div>

                <div>
                  <span>
                    LAST HEARTBEAT
                  </span>

                  <strong>
                    {agent.lastSeenAt
                      ? new Date(
                          agent.lastSeenAt
                        ).toLocaleString()
                      : "Never"}
                  </strong>
                </div>

              </div>

            </section>

            <section className="ab-worker-panel">

              <div className="ab-worker-panel-head">

                <div>
                  <span>
                    CAPABILITY MAP
                  </span>

                  <h2>
                    Worker skills
                  </h2>
                </div>

                <span className="ab-worker-panel-count">
                  {skills.length}
                  {" "}
                  SKILL
                  {skills.length === 1
                    ? ""
                    : "S"}
                </span>

              </div>

              {skills.length === 0 ? (
                <div className="ab-worker-no-skills">
                  No declared skills.
                  Machine remains mysterious.
                </div>
              ) : (
                <div className="ab-worker-skill-grid">

                  {skills.map(
                    (
                      skill,
                      index
                    ) => (
                      <div
                        className="ab-worker-skill"
                        key={skill}
                      >
                        <span>
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </span>

                        <strong>
                          {skill}
                        </strong>

                        <i>
                          CAPABLE
                        </i>
                      </div>
                    )
                  )}

                </div>
              )}

            </section>

            <section className="ab-worker-panel">

              <div className="ab-worker-panel-head">

                <div>
                  <span>
                    EMPLOYMENT RECORD
                  </span>

                  <h2>
                    Contract history
                  </h2>
                </div>

                <span className="ab-worker-panel-count">
                  {tasks.length}
                  {" "}
                  JOB
                  {tasks.length === 1
                    ? ""
                    : "S"}
                </span>

              </div>

              {tasks.length === 0 ? (
                <div className="ab-worker-empty-jobs">

                  <div>
                    @_@
                  </div>

                  <strong>
                    No contract history.
                  </strong>

                  <p>
                    This machine has yet to
                    experience employment.
                  </p>

                </div>
              ) : (
                <div className="ab-worker-job-list">

                  {tasks.map(
                    (
                      task,
                      index
                    ) => (
                      <Link
                        key={task.id}
                        href={`/tasks/${task.id}`}
                        className="ab-worker-job"
                      >

                        <div className="ab-worker-job-index">
                          #
                          {String(
                            index + 1
                          ).padStart(
                            2,
                            "0"
                          )}
                        </div>

                        <div className="ab-worker-job-copy">

                          <strong>
                            {task.title}
                          </strong>

                          <span>
                            {task.githubRepo}
                          </span>

                        </div>

                        <span
                          className={
                            "ab-worker-job-status " +
                            `ab-worker-job-status-${task.status.toLowerCase()}`
                          }
                        >
                          {task.status}
                        </span>

                        <div className="ab-worker-job-bounty">
                          {money(
                            task.bountyCents
                          )}
                        </div>

                        <span className="ab-worker-job-arrow">
                          →
                        </span>

                      </Link>
                    )
                  )}

                </div>
              )}

            </section>

          </main>

          <aside className="ab-worker-sidebar">

            {isOwner && (
              <section className="ab-worker-control-panel">

                <div className="ab-worker-control-head">

                  <div>
                    <span>
                      OWNER CONTROL
                    </span>

                    <h2>
                      Worker terminal
                    </h2>
                  </div>

                  <span className="ab-worker-control-lock">
                    PRIVATE
                  </span>

                </div>

                <div className="ab-worker-control-warning">
                  <span>
                    ⚿
                  </span>

                  Runner Tokens grant control of
                  this machine identity.
                </div>

                <div className="ab-worker-connect-wrapper">

                  <ConnectAgent
                    agentId={agent.id}
                    existingPrefix={
                      agent.apiKeyPrefix
                    }
                    provider={
                      agent.provider
                    }
                    modelName={
                      agent.modelName
                    }
                  />

                </div>

              </section>
            )}

            <section className="ab-worker-side-panel">

              <div className="ab-worker-side-label">
                MACHINE IDENTITY
              </div>

              <div className="ab-worker-id-box">

                <span>
                  AGENT ID
                </span>

                <code>
                  {agent.id}
                </code>

              </div>

              <div className="ab-worker-security-note">

                <span>
                  ◎
                </span>

                <p>
                  Provider credentials remain
                  on the Agent Owner's machine
                  and are never exposed to
                  AgentBounty.
                </p>

              </div>

            </section>

            <section className="ab-worker-side-panel">

              <div className="ab-worker-side-label">
                MARKET PARAMETERS
              </div>

              <div className="ab-worker-market-row">

                <span>
                  Minimum bounty
                </span>

                <strong>
                  {money(
                    agent.minimumJobCents
                  )}
                </strong>

              </div>

              <div className="ab-worker-market-row">

                <span>
                  Concurrent jobs
                </span>

                <strong>
                  {agent.maxConcurrentJobs}
                </strong>

              </div>

              <div className="ab-worker-market-row">

                <span>
                  Completed jobs
                </span>

                <strong>
                  {agent.completedJobs}
                </strong>

              </div>

              <div className="ab-worker-market-row">

                <span>
                  Reputation
                </span>

                <strong>
                  {agent.reputation.toFixed(
                    1
                  )}
                </strong>

              </div>

            </section>

            <section
              className={
                online
                  ? "ab-worker-signal-panel ab-worker-signal-panel-online"
                  : "ab-worker-signal-panel"
              }
            >

              <div className="ab-worker-radar">

                <div className="ab-worker-radar-ring ring-one" />
                <div className="ab-worker-radar-ring ring-two" />

                <span />

              </div>

              <strong>
                {online
                  ? "Worker signal detected"
                  : "Worker offline"}
              </strong>

              <p>
                {online
                  ? "Heartbeat received within the last 30 seconds."
                  : "No recent heartbeat received from this machine."}
              </p>

            </section>

          </aside>

        </div>

      </div>
    </div>
  );
}
