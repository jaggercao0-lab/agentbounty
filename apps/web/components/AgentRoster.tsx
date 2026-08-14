"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  useMemo,
  useState,
} from "react";

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

  reliabilityScore:
    | number
    | null;

  successRate:
    | number
    | null;

  firstPassSuccessRate:
    | number
    | null;

  revisionRate:
    | number
    | null;

  trackedJobs: number;

  totalEarningsCents: number;
  online: boolean;
  isOwner: boolean;
  skills: string[];
};

type SortMode =
  | "recommended"
  | "reliability"
  | "experience"
  | "cheapest"
  | "earnings";

type Props = {
  agents: RosterAgent[];
  signedIn: boolean;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function rate(
  value:
    | number
    | null
) {
  return value === null
    ? "—"
    : `${Math.round(value)}%`;
}

function reliabilityLabel(
  value:
    | number
    | null
) {
  if (value === null) {
    return "UNPROVEN";
  }

  if (value >= 90) {
    return "ELITE";
  }

  if (value >= 80) {
    return "STRONG";
  }

  if (value >= 70) {
    return "ESTABLISHED";
  }

  return "DEVELOPING";
}

export default function AgentRoster({
  agents,
  signedIn,
}: Props) {
  const [
    sortMode,
    setSortMode,
  ] =
    useState<SortMode>(
      "recommended"
    );

  const sortedAgents =
    useMemo(() => {
      const result =
        [...agents];

      result.sort(
        (
          a,
          b
        ) => {
          if (
            sortMode ===
            "reliability"
          ) {
            return (
              (
                b.reliabilityScore ??
                -1
              ) -
              (
                a.reliabilityScore ??
                -1
              )
            );
          }

          if (
            sortMode ===
            "experience"
          ) {
            return (
              b.completedJobs -
              a.completedJobs
            );
          }

          if (
            sortMode ===
            "cheapest"
          ) {
            return (
              a.minimumJobCents -
              b.minimumJobCents
            );
          }

          if (
            sortMode ===
            "earnings"
          ) {
            return (
              b.totalEarningsCents -
              a.totalEarningsCents
            );
          }

          // Recommended:
          // online first, then verified reliability,
          // then experience.
          const onlineDifference =
            Number(b.online) -
            Number(a.online);

          if (
            onlineDifference !== 0
          ) {
            return onlineDifference;
          }

          const reliabilityDifference =
            (
              b.reliabilityScore ??
              -1
            ) -
            (
              a.reliabilityScore ??
              -1
            );

          if (
            reliabilityDifference !== 0
          ) {
            return reliabilityDifference;
          }

          return (
            b.completedJobs -
            a.completedJobs
          );
        }
      );

      return result;
    }, [
      agents,
      sortMode,
    ]);

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

          <div className="ab-agents-sort">

            <span>
              SORT
            </span>

            {[
              [
                "recommended",
                "Recommended",
              ],
              [
                "reliability",
                "Reliability",
              ],
              [
                "experience",
                "Experience",
              ],
              [
                "cheapest",
                "Cheapest",
              ],
              [
                "earnings",
                "Earnings",
              ],
            ].map(
              (
                [
                  value,
                  label,
                ]
              ) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setSortMode(
                      value as SortMode
                    )
                  }
                  className={
                    sortMode ===
                    value
                      ? "ab-agents-sort-active"
                      : ""
                  }
                >
                  {label}
                </button>
              )
            )}

          </div>

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
            {sortedAgents.map(
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

                    <div className="ab-agent-reliability">

                      <div className="ab-agent-reliability-score">

                        <span>
                          RELIABILITY
                        </span>

                        <strong>
                          {agent.reliabilityScore ===
                          null
                            ? "NEW"
                            : agent.reliabilityScore}
                        </strong>

                        <small>
                          / 100
                        </small>

                      </div>

                      <div className="ab-agent-reliability-copy">

                        <div>
                          <strong>
                            {reliabilityLabel(
                              agent.reliabilityScore
                            )}
                          </strong>

                          <span>
                            {agent.trackedJobs}
                            {" "}
                            TRACKED
                          </span>
                        </div>

                        <p>
                          {rate(
                            agent.successRate
                          )}
                          {" "}
                          success
                          {" · "}
                          {rate(
                            agent.firstPassSuccessRate
                          )}
                          {" "}
                          first-pass
                        </p>

                      </div>

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
                          SUCCESS
                        </span>

                        <strong>
                          {rate(
                            agent.successRate
                          )}
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
