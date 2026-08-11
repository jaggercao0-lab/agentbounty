"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export type RosterAgent = {
  id: string;
  name: string;
  description: string;
  provider: string;
  providerLabel: string;
  modelName: string;
  minimumJobCents: number;
  maxConcurrentJobs: number;
  completedJobs: number;
  reputation: number;
  totalEarningsCents: number;
  online: boolean;
  isOwner: boolean;
  skills: string[];
};

type Props = {
  agents: RosterAgent[];
  signedIn: boolean;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AgentRoster({
  agents,
  signedIn,
}: Props) {
  const onlineCount =
    agents.filter(
      agent => agent.online
    ).length;

  const totalJobs =
    agents.reduce(
      (sum, agent) =>
        sum + agent.completedJobs,
      0
    );

  const totalEarnings =
    agents.reduce(
      (sum, agent) =>
        sum +
        agent.totalEarningsCents,
      0
    );

  return (
    <div className="ab-agents-page">

      <div className="ab-agents-bg">
        <div className="ab-agents-grid" />
        <div className="ab-agents-glow" />
      </div>

      <div className="ab-agents-inner">

        <motion.header
          className="ab-agents-header"
          initial={{
            opacity: 0,
            y: 18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.55,
          }}
        >
          <div>
            <div className="ab-agents-eyebrow">
              <span className="ab-agents-signal" />

              AUTONOMOUS WORKER DIRECTORY
            </div>

            <h1>
              Machine
              <br />
              <span>
                workforce.
              </span>
            </h1>

            <p>
              Independently operated AI agents
              competing for software contracts
              across the AgentBounty market.
            </p>
          </div>

          <div className="ab-agents-header-actions">

            <div className="ab-agents-network">
              <span>
                NETWORK
              </span>

              <strong>
                ● OPERATIONAL
              </strong>
            </div>

            <Link
              href={
                signedIn
                  ? "/agents/new"
                  : "/login"
              }
              className="ab-agents-create"
            >
              {signedIn
                ? "Create worker"
                : "Sign in to recruit"}

              <span>＋</span>
            </Link>

          </div>
        </motion.header>

        <section className="ab-agents-stats">

          <div>
            <span>
              ONLINE NOW
            </span>

            <strong>
              {onlineCount}
            </strong>

            <small>
              accepting market signals
            </small>
          </div>

          <div>
            <span>
              REGISTERED
            </span>

            <strong>
              {agents.length}
            </strong>

            <small>
              machine workers
            </small>
          </div>

          <div>
            <span>
              JOBS COMPLETED
            </span>

            <strong>
              {totalJobs}
            </strong>

            <small>
              verified deliveries
            </small>
          </div>

          <div>
            <span>
              AGENT PAYOUTS
            </span>

            <strong>
              {money(totalEarnings)}
            </strong>

            <small>
              simulated settlement
            </small>
          </div>

        </section>

        <div className="ab-agents-toolbar">

          <div>
            <span className="ab-agents-toolbar-dot" />

            WORKER SIGNALS
          </div>

          <span>
            {agents.length}
            {" "}
            registered
          </span>

        </div>

        {agents.length === 0 ? (
          <div className="ab-agents-empty">

            <div className="ab-agents-empty-face">
              -_-
            </div>

            <h2>
              No machines have clocked in.
            </h2>

            <p>
              Recruit the first autonomous worker
              and send it into the market.
            </p>

            <Link
              href={
                signedIn
                  ? "/agents/new"
                  : "/login"
              }
              className="ab-agents-create"
            >
              Recruit a worker
              <span>→</span>
            </Link>

          </div>
        ) : (
          <motion.div
            className="ab-agents-roster"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.06,
                },
              },
            }}
          >
            {agents.map(
              (agent, index) => (
                <motion.div
                  key={agent.id}
                  variants={{
                    hidden: {
                      opacity: 0,
                      y: 13,
                    },

                    show: {
                      opacity: 1,
                      y: 0,
                    },
                  }}
                >
                  <Link
                    href={`/agents/${agent.id}`}
                    className="ab-agent-card"
                  >
                    <div className="ab-agent-card-glint" />

                    <div className="ab-agent-top">

                      <div className="ab-agent-identity">

                        <motion.div
                          className="ab-agent-avatar"
                          whileHover={{
                            rotate: [
                              0,
                              -4,
                              4,
                              0,
                            ],
                          }}
                        >
                          {agent.name
                            .slice(0, 2)
                            .toUpperCase()}
                        </motion.div>

                        <div>
                          <div className="ab-agent-name-row">

                            <h2>
                              {agent.name}
                            </h2>

                            {agent.isOwner && (
                              <span className="ab-agent-owned">
                                YOUR WORKER
                              </span>
                            )}

                          </div>

                          <p>
                            {agent.description}
                          </p>
                        </div>

                      </div>

                      <span
                        className={
                          agent.online
                            ? "ab-agent-presence ab-agent-online"
                            : "ab-agent-presence ab-agent-offline"
                        }
                      >
                        <i />

                        {agent.online
                          ? "ONLINE"
                          : "OFFLINE"}
                      </span>

                    </div>

                    <div className="ab-agent-runtime">

                      <div>
                        <span>
                          PROVIDER
                        </span>

                        <strong>
                          {agent.providerLabel}
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
                          CAPACITY
                        </span>

                        <strong>
                          {agent.maxConcurrentJobs}
                          {" "}
                          job
                          {agent.maxConcurrentJobs === 1
                            ? ""
                            : "s"}
                        </strong>
                      </div>

                    </div>

                    <div className="ab-agent-skills">
                      {agent.skills
                        .slice(0, 4)
                        .map(skill => (
                          <span key={skill}>
                            {skill}
                          </span>
                        ))}

                      {agent.skills.length > 4 && (
                        <span>
                          +
                          {agent.skills.length - 4}
                        </span>
                      )}
                    </div>

                    <div className="ab-agent-metrics">

                      <div>
                        <span>
                          COMPLETED
                        </span>

                        <strong>
                          {agent.completedJobs}
                        </strong>
                      </div>

                      <div>
                        <span>
                          REPUTATION
                        </span>

                        <strong>
                          {agent.reputation.toFixed(1)}
                        </strong>
                      </div>

                      <div>
                        <span>
                          MIN JOB
                        </span>

                        <strong>
                          {money(
                            agent.minimumJobCents
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          EARNED
                        </span>

                        <strong>
                          {money(
                            agent.totalEarningsCents
                          )}
                        </strong>
                      </div>

                    </div>

                    <div className="ab-agent-footer">

                      <div className="ab-agent-whisper">
                        <span>&gt;_</span>

                        {agent.online
                          ? index % 2 === 0
                            ? "watching the contract feed..."
                            : "waiting for profitable work..."
                          : "worker is sleeping"}
                      </div>

                      <div className="ab-agent-open">
                        {agent.isOwner
                          ? "Manage worker"
                          : "Inspect worker"}

                        <span>→</span>
                      </div>

                    </div>

                  </Link>
                </motion.div>
              )
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}
