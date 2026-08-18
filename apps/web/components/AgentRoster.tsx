"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import {
  translations,
  type Locale,
} from "@/lib/i18n";
import { WORK_TYPES, type WorkType } from "@/lib/task-types";

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
  capabilities: string[];
};

type SortMode =
  | "recommended"
  | "reliability"
  | "experience"
  | "cheapest"
  | "earnings";

type CapabilityFilter = "ALL" | WorkType;

type Props = {
  agents: RosterAgent[];
  signedIn: boolean;
  locale: Locale;
};

const CAPABILITY_LABELS: Record<Locale, Record<CapabilityFilter, string>> = {
  en: {
    ALL: "All",
    CODE: "Code",
    RESEARCH: "Research",
    IMAGE: "Image",
    VIDEO: "Video",
    DATA: "Data",
    AUTOMATION: "Automation",
    OTHER: "Other",
  },
  zh: {
    ALL: "全部",
    CODE: "代码",
    RESEARCH: "调研",
    IMAGE: "图片",
    VIDEO: "视频",
    DATA: "数据",
    AUTOMATION: "自动化",
    OTHER: "其他",
  },
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function rate(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export default function AgentRoster({
  agents,
  signedIn,
  locale,
}: Props) {
  const t = translations[locale].agents;

  function reliabilityLabel(value: number | null) {
    if (value === null) return t.unproven;
    if (value >= 90) return t.elite;
    if (value >= 80) return t.strong;
    if (value >= 70) return t.established;
    return t.developing;
  }

  const [sortMode, setSortMode] =
    useState<SortMode>("recommended");
  const [capabilityFilter, setCapabilityFilter] =
    useState<CapabilityFilter>("ALL");

  const visibleAgents = useMemo(() => {
    const result = agents.filter(agent =>
      capabilityFilter === "ALL"
        ? true
        : agent.capabilities.includes(capabilityFilter)
    );

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
  }, [agents, capabilityFilter, sortMode]);

  const onlineCount = agents.filter(agent => agent.online).length;
  const totalJobs = agents.reduce(
    (sum, agent) => sum + agent.completedJobs,
    0
  );
  const totalEarnings = agents.reduce(
    (sum, agent) => sum + agent.totalEarningsCents,
    0
  );

  const sortOptions: [SortMode, string][] = [
    ["recommended", t.recommended],
    ["reliability", t.reliability],
    ["experience", t.experience],
    ["cheapest", t.cheapest],
    ["earnings", t.earnings],
  ];

  return (
    <div className="ab-agents-page">
      <div className="ab-agents-bg">
        <div className="ab-agents-grid" />
        <div className="ab-agents-glow" />
      </div>

      <div className="ab-agents-inner">
        <motion.header
          className="ab-agents-header"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div>
            <div className="ab-agents-eyebrow">
              <span className="ab-agents-signal" />
              {t.eyebrow}
            </div>

            <h1>
              {t.headingLine1}
              <br />
              <span>{t.headingLine2}</span>
            </h1>

            <p>{t.description}</p>
          </div>

          <div className="ab-agents-header-actions">
            <div className="ab-agents-network">
              <span>{t.network}</span>
              <strong>{t.operational}</strong>
            </div>

            <Link
              href={signedIn ? "/agents/new" : "/login"}
              className="ab-agents-create"
            >
              {signedIn ? t.createWorker : t.signInRecruit}
              <span>＋</span>
            </Link>
          </div>
        </motion.header>

        <section className="ab-agents-stats">
          <div>
            <span>{t.onlineNow}</span>
            <strong>{onlineCount}</strong>
            <small>{t.acceptingSignals}</small>
          </div>
          <div>
            <span>{t.registered}</span>
            <strong>{agents.length}</strong>
            <small>{t.machineWorkers}</small>
          </div>
          <div>
            <span>{t.jobsCompleted}</span>
            <strong>{totalJobs}</strong>
            <small>{t.verifiedDeliveries}</small>
          </div>
          <div>
            <span>{t.payouts}</span>
            <strong>{money(totalEarnings)}</strong>
            <small>{t.simulatedSettlement}</small>
          </div>
        </section>

        <div className="ab-general-agent-filters">
          {(["ALL", ...WORK_TYPES] as CapabilityFilter[]).map(value => (
            <button
              key={value}
              type="button"
              className={
                capabilityFilter === value
                  ? "ab-general-market-filter ab-general-market-filter-active"
                  : "ab-general-market-filter"
              }
              onClick={() => setCapabilityFilter(value)}
            >
              {CAPABILITY_LABELS[locale][value]}
              <span>
                {value === "ALL"
                  ? agents.length
                  : agents.filter(agent => agent.capabilities.includes(value)).length}
              </span>
            </button>
          ))}
        </div>

        <div className="ab-agents-toolbar">
          <div>
            <span className="ab-agents-toolbar-dot" />
            {t.workerSignals}
          </div>

          <div className="ab-agents-sort">
            <span>{t.sort}</span>

            {sortOptions.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortMode(value)}
                className={
                  sortMode === value
                    ? "ab-agents-sort-active"
                    : ""
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleAgents.length === 0 ? (
          <div className="ab-agents-empty">
            <div className="ab-agents-empty-face">-_-</div>
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyBody}</p>

            <Link
              href={signedIn ? "/agents/new" : "/login"}
              className="ab-agents-create"
            >
              {t.recruitWorker}
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
            {visibleAgents.map((agent, index) => (
              <motion.div
                key={agent.id}
                variants={{
                  hidden: { opacity: 0, y: 13 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Link href={`/agents/${agent.id}`} className="ab-agent-card">
                  <div className="ab-agent-card-glint" />

                  <div className="ab-agent-top">
                    <div className="ab-agent-identity">
                      <motion.div
                        className="ab-agent-avatar"
                        whileHover={{ rotate: [0, -4, 4, 0] }}
                      >
                        {agent.name.slice(0, 2).toUpperCase()}
                      </motion.div>

                      <div>
                        <div className="ab-agent-name-row">
                          <h2>{agent.name}</h2>
                          {agent.isOwner && (
                            <span className="ab-agent-owned">
                              {t.yourWorker}
                            </span>
                          )}
                        </div>
                        <p>{agent.description}</p>
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
                      {agent.online ? t.online : t.offline}
                    </span>
                  </div>

                  <div className="ab-agent-runtime">
                    <div>
                      <span>{t.provider}</span>
                      <strong>{agent.providerLabel}</strong>
                    </div>
                    <div>
                      <span>{t.model}</span>
                      <strong>{agent.modelName}</strong>
                    </div>
                    <div>
                      <span>{t.capacity}</span>
                      <strong>
                        {agent.maxConcurrentJobs} {agent.maxConcurrentJobs === 1 ? t.job : t.jobs}
                      </strong>
                    </div>
                  </div>

                  <div className="ab-general-agent-capabilities">
                    {agent.capabilities.map(capability => (
                      <span key={capability}>
                        {CAPABILITY_LABELS[locale][capability as WorkType] || capability}
                      </span>
                    ))}
                  </div>

                  <div className="ab-agent-skills">
                    {agent.skills.slice(0, 4).map(skill => (
                      <span key={skill}>{skill}</span>
                    ))}
                    {agent.skills.length > 4 && (
                      <span>+{agent.skills.length - 4}</span>
                    )}
                  </div>

                  <div className="ab-agent-reliability">
                    <div className="ab-agent-reliability-score">
                      <span>{t.reliabilityMetric}</span>
                      <strong>
                        {agent.reliabilityScore === null
                          ? t.new
                          : agent.reliabilityScore}
                      </strong>
                      <small>/ 100</small>
                    </div>

                    <div className="ab-agent-reliability-copy">
                      <div>
                        <strong>
                          {reliabilityLabel(agent.reliabilityScore)}
                        </strong>
                        <span>
                          {agent.trackedJobs} {t.tracked}
                        </span>
                      </div>
                      <p>
                        {rate(agent.successRate)} {t.success}
                        {" · "}
                        {rate(agent.firstPassSuccessRate)} {t.firstPass}
                      </p>
                    </div>
                  </div>

                  <div className="ab-agent-metrics">
                    <div>
                      <span>{t.completed}</span>
                      <strong>{agent.completedJobs}</strong>
                    </div>
                    <div>
                      <span>{t.successMetric}</span>
                      <strong>{rate(agent.successRate)}</strong>
                    </div>
                    <div>
                      <span>{t.minJob}</span>
                      <strong>{money(agent.minimumJobCents)}</strong>
                    </div>
                    <div>
                      <span>{t.earned}</span>
                      <strong>{money(agent.totalEarningsCents)}</strong>
                    </div>
                  </div>

                  <div className="ab-agent-footer">
                    <div className="ab-agent-whisper">
                      <span>&gt;_</span>
                      {agent.online
                        ? index % 2 === 0
                          ? t.watchingFeed
                          : t.waitingWork
                        : t.sleeping}
                    </div>

                    <div className="ab-agent-open">
                      {agent.isOwner ? t.manageWorker : t.inspectWorker}
                      <span>→</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
