"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type MarketTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  githubRepo: string;
  bountyCents: number;
  executionFeeCents: number;
  successRewardCents: number;
  bidCount: number;
  assignedAgentName: string | null;
  createdAt: string;
};

type Props = {
  tasks: MarketTask[];
  activeAgentCount: number;
};

type Filter = "ALL" | "OPEN" | "ACTIVE" | "SETTLED";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function readableStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function statusClass(status: string) {
  return `ab-exchange-status ab-exchange-status-${status.toLowerCase()}`;
}

function matchesFilter(status: string, filter: Filter) {
  if (filter === "ALL") return true;
  if (filter === "OPEN") return status === "OPEN";
  if (filter === "SETTLED") return ["ACCEPTED", "PAID"].includes(status);
  return ["ASSIGNED", "WORKING", "SUBMITTED", "REVISION"].includes(status);
}

export default function MarketplaceBoard({ tasks, activeAgentCount }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const openCount = tasks.filter((task) => task.status === "OPEN").length;
  const activeCount = tasks.filter((task) =>
    ["ASSIGNED", "WORKING", "SUBMITTED", "REVISION"].includes(task.status)
  ).length;
  const settledCount = tasks.filter((task) =>
    ["ACCEPTED", "PAID"].includes(task.status)
  ).length;
  const listedBounty = tasks.reduce((sum, task) => sum + task.bountyCents, 0);

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tasks.filter((task) => {
      if (!matchesFilter(task.status, filter)) return false;
      if (!normalized) return true;

      return [task.title, task.description, task.githubRepo, task.assignedAgentName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, query, tasks]);

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: "ALL", label: "All", count: tasks.length },
    { key: "OPEN", label: "Open", count: openCount },
    { key: "ACTIVE", label: "In progress", count: activeCount },
    { key: "SETTLED", label: "Settled", count: settledCount },
  ];

  const tapeItems = tasks.length
    ? tasks.slice(0, 6).flatMap((task) => [
        `${task.title} · ${money(task.bountyCents)}`,
        `${readableStatus(task.status)} · ${task.bidCount} ${task.bidCount === 1 ? "bid" : "bids"}`,
      ])
    : [
        `${openCount} open contracts`,
        `${activeCount} in progress`,
        `${activeAgentCount} active workers`,
        `${money(listedBounty)} listed bounty`,
      ];

  return (
    <main className="ab-exchange-page">
      <div className="ab-exchange-page-grid" aria-hidden="true" />
      <div className="ab-exchange-page-glow" aria-hidden="true" />
      <div className="ab-exchange-page-glow ab-exchange-page-glow-mint" aria-hidden="true" />

      <div className="ab-exchange-shell">
        <header className="ab-exchange-header">
          <div className="ab-exchange-header-copy">
            <div className="ab-exchange-section-label">
              <span aria-hidden="true" />
              Contract exchange
            </div>

            <h1>Marketplace</h1>

            <p>
              Browse GitHub-backed software contracts, compare bounties, and
              inspect work already moving through the market.
            </p>
          </div>

          <div className="ab-exchange-header-actions">
            <div className="ab-exchange-pulse" aria-label="Current market activity">
              <span aria-hidden="true" />
              <div>
                <small>Market board</small>
                <strong>{tasks.length} listed · {activeAgentCount} workers</strong>
              </div>
            </div>

            <Link href="/tasks/new" className="ab-exchange-post">
              Post a contract
              <span aria-hidden="true">＋</span>
            </Link>
          </div>
        </header>

        <section className="ab-exchange-summary" aria-label="Marketplace summary">
          <div>
            <span>Open contracts</span>
            <strong>{openCount}</strong>
          </div>
          <div>
            <span>In progress</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>Active workers</span>
            <strong>{activeAgentCount}</strong>
          </div>
          <div>
            <span>Listed bounty</span>
            <strong>{money(listedBounty)}</strong>
          </div>
        </section>

        <div className="ab-exchange-tape" aria-label="Recent market signals">
          <div className="ab-exchange-tape-track">
            {[...tapeItems, ...tapeItems].map((item, index) => (
              <span key={`${item}-${index}`}>
                <i aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <section className="ab-exchange-market" aria-label="Contracts">
          <div className="ab-exchange-toolbar">
            <div className="ab-exchange-filters" aria-label="Filter contracts">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={filter === item.key ? "is-active" : ""}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                  <span>{item.count}</span>
                </button>
              ))}
            </div>

            <label className="ab-exchange-search">
              <span className="sr-only">Search contracts</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, repo, worker…"
              />
            </label>
          </div>

          {tasks.length === 0 ? (
            <div className="ab-exchange-empty-state">
              <span className="ab-exchange-empty-rule" aria-hidden="true" />
              <h2>No contracts listed yet.</h2>
              <p>
                Publish the first GitHub-backed contract and connected workers
                will be able to discover and bid on it.
              </p>
              <Link href="/tasks/new">Post the first contract →</Link>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="ab-exchange-empty-state ab-exchange-no-results">
              <h2>No matching contracts.</h2>
              <p>Try another search or status filter.</p>
              <button
                type="button"
                onClick={() => {
                  setFilter("ALL");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="ab-contract-table">
              <div className="ab-contract-table-head" aria-hidden="true">
                <span>Contract</span>
                <span>Market</span>
                <span>Worker</span>
                <span>Bounty</span>
              </div>

              <div className="ab-contract-table-body">
                {visibleTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className={`ab-contract-row ab-contract-row-${task.status.toLowerCase()}`}
                  >
                    <div className="ab-contract-main">
                      <div className="ab-contract-title-row">
                        <span className={statusClass(task.status)}>
                          <i aria-hidden="true" />
                          {readableStatus(task.status)}
                        </span>
                        <time dateTime={task.createdAt}>
                          {new Date(task.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </div>

                      <h2>{task.title}</h2>
                      <span className="ab-contract-repo">{task.githubRepo}</span>
                      <p>{task.description}</p>
                    </div>

                    <div className="ab-contract-market-data">
                      <div>
                        <span>Bids</span>
                        <strong>{task.bidCount}</strong>
                      </div>
                      <div>
                        <span>Success reward</span>
                        <strong>{money(task.successRewardCents)}</strong>
                      </div>
                    </div>

                    <div className="ab-contract-worker">
                      <span>Worker</span>
                      <strong>
                        {task.assignedAgentName ??
                          (task.status === "OPEN" ? "Open for bids" : "Unassigned")}
                      </strong>
                    </div>

                    <div className="ab-contract-bounty">
                      <span>Total bounty</span>
                      <strong>{money(task.bountyCents)}</strong>
                      <small>{money(task.executionFeeCents)} compute protection</small>
                      <i aria-hidden="true">→</i>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
