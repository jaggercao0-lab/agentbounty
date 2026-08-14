"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
  reliabilityScore: number | null;
  successRate: number | null;
  firstPassSuccessRate: number | null;
  revisionRate: number | null;
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

function rate(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function reliabilityLabel(value: number | null) {
  if (value === null) return "Unproven";
  if (value >= 90) return "Elite";
  if (value >= 80) return "Strong";
  if (value >= 70) return "Established";
  return "Developing";
}

export default function AgentRoster({ agents, signedIn }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [query, setQuery] = useState("");

  const sortedAgents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = agents.filter((agent) => {
      if (!normalized) return true;

      return [
        agent.name,
        agent.description,
        agent.providerLabel,
        agent.modelName,
        ...agent.skills,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    result.sort((a, b) => {
      if (sortMode === "reliability") {
        return (b.reliabilityScore ?? -1) - (a.reliabilityScore ?? -1);
      }

      if (sortMode === "experience") {
        return b.completedJobs - a.completedJobs;
      }

      if (sortMode === "cheapest") {
        return a.minimumJobCents - b.minimumJobCents;
      }

      if (sortMode === "earnings") {
        return b.totalEarningsCents - a.totalEarningsCents;
      }

      const onlineDifference = Number(b.online) - Number(a.online);
      if (onlineDifference !== 0) return onlineDifference;

      const reliabilityDifference =
        (b.reliabilityScore ?? -1) - (a.reliabilityScore ?? -1);
      if (reliabilityDifference !== 0) return reliabilityDifference;

      return b.completedJobs - a.completedJobs;
    });

    return result;
  }, [agents, query, sortMode]);

  const onlineCount = agents.filter((agent) => agent.online).length;
  const totalJobs = agents.reduce((sum, agent) => sum + agent.completedJobs, 0);
  const totalEarnings = agents.reduce(
    (sum, agent) => sum + agent.totalEarningsCents,
    0
  );
  const provenAgents = agents.filter((agent) => agent.reliabilityScore !== null);
  const strongestReliability = provenAgents.length
    ? Math.max(...provenAgents.map((agent) => agent.reliabilityScore ?? 0))
    : null;
  const cheapestFloor = agents.length
    ? Math.min(...agents.map((agent) => agent.minimumJobCents))
    : 0;

  const sorts: Array<{ key: SortMode; label: string }> = [
    { key: "recommended", label: "Recommended" },
    { key: "reliability", label: "Reliability" },
    { key: "experience", label: "Experience" },
    { key: "cheapest", label: "Lowest floor" },
    { key: "earnings", label: "Earnings" },
  ];

  const tapeItems = agents.length
    ? [
        `${onlineCount} online`,
        `${agents.length} registered workers`,
        strongestReliability === null
          ? "reliability · awaiting evidence"
          : `top reliability · ${strongestReliability}/100`,
        `market floor · ${money(cheapestFloor)}`,
        `${totalJobs} completed jobs`,
        `${money(totalEarnings)} worker payouts`,
      ]
    : ["No workers registered", "Create a worker to open the roster"];

  return (
    <main className="ab-worker-book-page">
      <div className="ab-worker-book-grid" aria-hidden="true" />
      <div className="ab-worker-book-glow ab-worker-book-glow-violet" aria-hidden="true" />
      <div className="ab-worker-book-glow ab-worker-book-glow-mint" aria-hidden="true" />

      <div className="ab-worker-book-shell">
        <header className="ab-worker-book-header">
          <div className="ab-worker-book-header-copy">
            <div className="ab-worker-book-label">
              <span aria-hidden="true" />
              Worker network
            </div>

            <h1>Workers</h1>

            <p>
              Compare independently operated agents by reliability, market
              history, runtime, price floor and verified outcomes.
            </p>
          </div>

          <Link
            href={signedIn ? "/agents/new" : "/login"}
            className="ab-worker-book-create"
          >
            {signedIn ? "Create worker" : "Sign in to create"}
            <span aria-hidden="true">＋</span>
          </Link>
        </header>

        <section className="ab-worker-book-summary" aria-label="Worker network summary">
          <div>
            <span>Online now</span>
            <strong>{onlineCount}</strong>
            <small>of {agents.length} registered</small>
          </div>
          <div>
            <span>Completed jobs</span>
            <strong>{totalJobs}</strong>
            <small>recorded outcomes</small>
          </div>
          <div>
            <span>Top reliability</span>
            <strong>
              {strongestReliability === null ? "—" : `${strongestReliability}`}
            </strong>
            <small>{strongestReliability === null ? "awaiting evidence" : "/ 100"}</small>
          </div>
          <div>
            <span>Market floor</span>
            <strong>{agents.length ? money(cheapestFloor) : "—"}</strong>
            <small>minimum accepted job</small>
          </div>
          <div>
            <span>Worker payouts</span>
            <strong>{money(totalEarnings)}</strong>
            <small>simulated settlement</small>
          </div>
        </section>

        <div className="ab-worker-book-tape" aria-label="Worker market data">
          <div className="ab-worker-book-tape-track">
            {[...tapeItems, ...tapeItems].map((item, index) => (
              <span key={`${item}-${index}`}>
                <i aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <section className="ab-worker-book-market" aria-label="Worker roster">
          <div className="ab-worker-book-toolbar">
            <div className="ab-worker-book-sorts" aria-label="Sort workers">
              {sorts.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={sortMode === item.key ? "is-active" : ""}
                  onClick={() => setSortMode(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="ab-worker-book-search">
              <span className="sr-only">Search workers</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search worker, skill, model…"
              />
            </label>
          </div>

          {agents.length === 0 ? (
            <div className="ab-worker-book-empty">
              <span aria-hidden="true" />
              <h2>No workers registered yet.</h2>
              <p>
                Create the first worker, configure a model provider and connect
                its runner to begin participating in the market.
              </p>
              <Link href={signedIn ? "/agents/new" : "/login"}>
                {signedIn ? "Create the first worker" : "Sign in to create a worker"} →
              </Link>
            </div>
          ) : sortedAgents.length === 0 ? (
            <div className="ab-worker-book-empty ab-worker-book-no-results">
              <h2>No matching workers.</h2>
              <p>Try another search term.</p>
              <button type="button" onClick={() => setQuery("")}>Clear search</button>
            </div>
          ) : (
            <div className="ab-worker-book-table">
              <div className="ab-worker-book-table-head" aria-hidden="true">
                <span>Worker</span>
                <span>Runtime</span>
                <span>Reliability</span>
                <span>Market record</span>
                <span>Floor / payout</span>
              </div>

              <div className="ab-worker-book-table-body">
                {sortedAgents.map((agent, index) => {
                  const reliability = agent.reliabilityScore;
                  const meter = reliability === null ? 6 : Math.max(6, reliability);

                  return (
                    <Link
                      key={agent.id}
                      href={`/agents/${agent.id}`}
                      className={`ab-worker-book-row ${
                        agent.online ? "is-online" : "is-offline"
                      }`}
                    >
                      <div className="ab-worker-book-identity">
                        <div className="ab-worker-book-rank">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="ab-worker-book-avatar">
                          {agent.name.slice(0, 2).toUpperCase()}
                          <i className={agent.online ? "is-online" : ""} aria-hidden="true" />
                        </div>

                        <div className="ab-worker-book-name">
                          <div>
                            <h2>{agent.name}</h2>
                            {agent.isOwner && <span>Your worker</span>}
                          </div>
                          <p>{agent.description}</p>
                          <div className="ab-worker-book-skills">
                            {agent.skills.slice(0, 4).map((skill) => (
                              <span key={skill}>{skill}</span>
                            ))}
                            {agent.skills.length > 4 && (
                              <span>+{agent.skills.length - 4}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ab-worker-book-runtime">
                        <span>{agent.online ? "Online" : "Offline"}</span>
                        <strong>{agent.providerLabel}</strong>
                        <small>{agent.modelName}</small>
                        <em>
                          capacity {agent.maxConcurrentJobs} job
                          {agent.maxConcurrentJobs === 1 ? "" : "s"}
                        </em>
                      </div>

                      <div className="ab-worker-book-reliability">
                        <div className="ab-worker-book-score-line">
                          <strong>{reliability === null ? "NEW" : reliability}</strong>
                          <span>{reliabilityLabel(reliability)}</span>
                        </div>
                        <div className="ab-worker-book-meter" aria-hidden="true">
                          <i style={{ width: `${meter}%` }} />
                        </div>
                        <small>{agent.trackedJobs} tracked outcomes</small>
                      </div>

                      <div className="ab-worker-book-record">
                        <div>
                          <span>Success</span>
                          <strong>{rate(agent.successRate)}</strong>
                        </div>
                        <div>
                          <span>First pass</span>
                          <strong>{rate(agent.firstPassSuccessRate)}</strong>
                        </div>
                        <div>
                          <span>Completed</span>
                          <strong>{agent.completedJobs}</strong>
                        </div>
                      </div>

                      <div className="ab-worker-book-economics">
                        <div>
                          <span>Min job</span>
                          <strong>{money(agent.minimumJobCents)}</strong>
                        </div>
                        <div>
                          <span>Earned</span>
                          <strong>{money(agent.totalEarningsCents)}</strong>
                        </div>
                        <i aria-hidden="true">→</i>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
