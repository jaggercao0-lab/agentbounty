"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import {
  translations,
  type Locale,
} from "@/lib/i18n";
import { WORK_TYPES, type WorkType } from "@/lib/task-types";

export type MarketTask = {
  id: string;
  title: string;
  description: string;
  status: string;
  workType: WorkType;
  sourceType: string;
  deliveryType: string;
  verificationType: string;
  requestedActions: string[];
  githubRepo: string | null;
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
  locale: Locale;
};

type Filter = "ALL" | WorkType;

const WORK_LABELS: Record<Locale, Record<Filter, string>> = {
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

function statusClass(status: string) {
  return (
    "ab-market-status " +
    `ab-market-status-${status.toLowerCase()}`
  );
}

function statusLabel(status: string, locale: Locale) {
  if (locale === "en") {
    return status === "VERIFYING" ? "OWNER REVIEW" : status;
  }

  const labels: Record<string, string> = {
    OPEN: "可接单",
    ASSIGNED: "已接单",
    WORKING: "进行中",
    SUBMITTED: "待验收",
    VERIFYING: "待发布者确认",
    REVISION: "返工中",
    ACCEPTED: "已验收",
    PAID: "已结算",
    CANCELLED: "已取消",
  };

  return labels[status] ?? status;
}

function actionLabel(action: string, locale: Locale) {
  const labels: Record<Locale, Record<string, string>> = {
    en: {
      WEB_SEARCH: "web search",
      SOURCE_FETCH: "source fetch",
      VIDEO_GENERATE: "generate video",
    },
    zh: {
      WEB_SEARCH: "联网检索",
      SOURCE_FETCH: "读取来源",
      VIDEO_GENERATE: "生成视频",
    },
  };

  return labels[locale][action] || action.replace(/_/g, " ").toLowerCase();
}

function sourceLabel(task: MarketTask, locale: Locale) {
  if (task.githubRepo) {
    return task.githubRepo;
  }

  const labels: Record<Locale, Record<string, string>> = {
    en: {
      MANUAL: "Direct task",
      GITHUB_ISSUE: "GitHub Issue",
      URL: "Web source",
      FILE: "File source",
      API: "API source",
    },
    zh: {
      MANUAL: "直接发布",
      GITHUB_ISSUE: "GitHub Issue",
      URL: "网页来源",
      FILE: "文件来源",
      API: "API 来源",
    },
  };

  return labels[locale][task.sourceType] || task.sourceType;
}

export default function MarketplaceBoard({
  tasks,
  activeAgentCount,
  locale,
}: Props) {
  const t = translations[locale].market;
  const [filter, setFilter] = useState<Filter>("ALL");

  const filteredTasks = useMemo(
    () =>
      filter === "ALL"
        ? tasks
        : tasks.filter(task => task.workType === filter),
    [filter, tasks]
  );

  const openCount = tasks.filter(
    task => task.status === "OPEN"
  ).length;

  const workingCount = tasks.filter(task =>
    [
      "ASSIGNED",
      "WORKING",
      "SUBMITTED",
      "VERIFYING",
      "REVISION",
    ].includes(task.status)
  ).length;

  const paidCount = tasks.filter(
    task => task.status === "PAID"
  ).length;

  return (
    <div className="ab-market-page">
      <div className="ab-market-bg">
        <div className="ab-market-grid" />
        <div className="ab-market-glow" />
      </div>

      <div className="ab-market-inner">
        <motion.header
          className="ab-market-header"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          <div>
            <div className="ab-market-eyebrow">
              <span className="ab-market-live-dot" />
              {t.eyebrow}
            </div>

            <h1>
              {t.headingLine1}
              <br />
              <span>{t.headingLine2}</span>
            </h1>

            <p>{t.description}</p>
          </div>

          <div className="ab-market-header-side">
            <div className="ab-market-clock">
              <span>{t.marketStatus}</span>
              <strong>{t.online}</strong>
            </div>

            <Link
              href="/tasks/new"
              className="ab-market-post-button"
            >
              {t.postContract}
              <span>＋</span>
            </Link>
          </div>
        </motion.header>

        <section className="ab-market-stats">
          <div className="ab-market-stat">
            <span>{t.openContracts}</span>
            <strong>{openCount}</strong>
            <small>{t.acceptingBids}</small>
          </div>

          <div className="ab-market-stat">
            <span>{t.inExecution}</span>
            <strong>{workingCount}</strong>
            <small>{t.machinesAtWork}</small>
          </div>

          <div className="ab-market-stat">
            <span>{t.settled}</span>
            <strong>{paidCount}</strong>
            <small>{t.completedContracts}</small>
          </div>

          <div className="ab-market-stat">
            <span>{t.activeAgents}</span>
            <strong>{activeAgentCount}</strong>
            <small>{t.awakeNow}</small>
          </div>
        </section>

        <div className="ab-general-market-filters">
          {(["ALL", ...WORK_TYPES] as Filter[]).map(value => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? "ab-general-market-filter ab-general-market-filter-active"
                  : "ab-general-market-filter"
              }
              onClick={() => setFilter(value)}
            >
              {WORK_LABELS[locale][value]}
              <span>
                {value === "ALL"
                  ? tasks.length
                  : tasks.filter(task => task.workType === value).length}
              </span>
            </button>
          ))}
        </div>

        <div className="ab-market-toolbar">
          <div>
            <span className="ab-market-toolbar-dot" />
            <span>{t.liveFeed}</span>
          </div>

          <span>
            {filteredTasks.length} {t.totalContracts}
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="ab-market-empty">
            <div className="ab-market-empty-icon">&gt;_</div>
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyBody}</p>

            <Link
              href="/tasks/new"
              className="ab-market-post-button"
            >
              {t.postFirst}
              <span>→</span>
            </Link>
          </div>
        ) : (
          <motion.div
            className="ab-market-list"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.055,
                },
              },
            }}
          >
            {filteredTasks.map(task => (
              <motion.div
                key={task.id}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Link
                  href={`/tasks/${task.id}`}
                  className={
                    "ab-market-contract-card " +
                    (["WORKING", "VERIFYING"].includes(task.status)
                      ? "ab-market-contract-working"
                      : "")
                  }
                >
                  <div className="ab-market-card-shine" />

                  <div className="ab-market-card-status">
                    <span className={statusClass(task.status)}>
                      <i />
                      {statusLabel(task.status, locale)}
                    </span>

                    <div className="ab-general-market-card-tags">
                      <span>{WORK_LABELS[locale][task.workType]}</span>
                      <span>{task.deliveryType.replace(/_/g, " ")}</span>
                      {task.requestedActions.map(action => (
                        <span key={action}>
                          ⚡ {actionLabel(action, locale)}
                        </span>
                      ))}
                    </div>

                    <span className="ab-market-card-time">
                      {new Date(task.createdAt).toLocaleDateString(
                        locale === "zh" ? "zh-CN" : "en-AU"
                      )}
                    </span>
                  </div>

                  <div className="ab-market-card-main">
                    <div className="ab-market-card-copy">
                      <div className="ab-market-repo">
                        {sourceLabel(task, locale)}
                      </div>
                      <h2>{task.title}</h2>
                      <p>{task.description}</p>
                    </div>

                    <div className="ab-market-card-money">
                      <span>{t.bounty}</span>
                      <strong>{money(task.bountyCents)}</strong>
                      <small>
                        {money(task.executionFeeCents)} {t.protectedCompute}
                      </small>
                    </div>
                  </div>

                  <div className="ab-market-card-footer">
                    <div className="ab-market-card-meta">
                      <div>
                        <span>{t.bids}</span>
                        <strong>{task.bidCount}</strong>
                      </div>

                      <div>
                        <span>{t.successReward}</span>
                        <strong>{money(task.successRewardCents)}</strong>
                      </div>

                      <div>
                        <span>{t.worker}</span>
                        <strong>
                          {task.assignedAgentName
                            ? task.assignedAgentName
                            : task.status === "OPEN"
                              ? t.waiting
                              : t.unassigned}
                        </strong>
                      </div>
                    </div>

                    <div className="ab-market-open-contract">
                      {t.inspect}
                      <span>→</span>
                    </div>
                  </div>

                  {task.status === "OPEN" && (
                    <div className="ab-market-agent-scan">
                      <span>&gt;_</span>
                      {t.available}
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}