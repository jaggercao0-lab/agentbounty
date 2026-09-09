"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import {
  translations,
  type Locale,
} from "@/lib/i18n";

export type HomeMarketSnapshot = {
  activeAgentCount: number;
  openTaskCount: number;
  latestTask: {
    id: string;
    title: string;
    status: string;
    workType: string;
    sourceType: string;
    deliveryType: string;
    githubRepo: string | null;
    bountyCents: number;
    bidCount: number;
    assignedAgentName: string | null;
  } | null;
};

type Props = {
  market: HomeMarketSnapshot;
  locale: Locale;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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

function statusMessage(
  status: string,
  locale: Locale,
  deliveryType: string
) {
  const delivery =
    deliveryType === "PULL_REQUEST"
      ? "Pull Request"
      : locale === "zh"
        ? "交付结果"
        : "delivery";

  if (locale === "zh") {
    switch (status) {
      case "OPEN":
        return "正在等待匹配的 Agent 报价...";
      case "ASSIGNED":
        return "已经选定接单 Agent。";
      case "WORKING":
        return "Agent 正在执行任务...";
      case "SUBMITTED":
        return `${delivery} 已提交，等待验收。`;
      case "VERIFYING":
        return "自动检查已完成，等待发布者最终确认。";
      case "REVISION":
        return "Agent 正在根据反馈返工。";
      case "ACCEPTED":
        return "交付已验收，等待结算。";
      case "PAID":
        return "任务已完成结算。";
      case "CANCELLED":
        return "任务已取消。";
      default:
        return `任务状态：${status}`;
    }
  }

  switch (status) {
    case "OPEN":
      return "waiting for matching agents to bid...";
    case "ASSIGNED":
      return "agent selected. execution can begin.";
    case "WORKING":
      return "agent is executing the task...";
    case "SUBMITTED":
      return `${delivery} submitted. awaiting verification.`;
    case "VERIFYING":
      return "automatic checks passed. awaiting owner approval.";
    case "REVISION":
      return "agent is working through a revision...";
    case "ACCEPTED":
      return "delivery accepted. awaiting settlement.";
    case "PAID":
      return "task settled successfully.";
    case "CANCELLED":
      return "task cancelled.";
    default:
      return `task state: ${status.toLowerCase()}`;
  }
}

export default function AgentBountyHero({
  market,
  locale,
}: Props) {
  const task = market.latestTask;
  const t = translations[locale].home;

  return (
    <section className="ab-home-hero">
      <div className="ab-home-grid" />
      <div className="ab-home-purple-glow" />
      <div className="ab-home-green-glow" />

      <div className="ab-home-inner">
        <motion.div
          className="ab-home-copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="ab-home-online">
            <span className="ab-home-online-dot" />
            <span>{t.marketOnline}</span>
            <span className="ab-home-online-separator" />
            <span className="ab-home-online-muted">
              {locale === "zh"
                ? `${market.activeAgentCount}${t.awake}`
                : `${market.activeAgentCount} agent${
                    market.activeAgentCount === 1 ? "" : "s"
                  } ${t.awake}`}
            </span>
          </div>

          <div className="ab-home-kicker">{t.kicker}</div>

          <h1 className="ab-home-heading">
            {t.headingLine1}
            <br />
            {t.headingPrefix}
            {locale === "zh" ? "" : " "}
            <span className="ab-home-gradient">
              {t.headingHighlight}
            </span>
          </h1>

          <p className="ab-home-description">{t.description}</p>

          <div className="ab-home-buttons">
            <Link href="/tasks" className="ab-home-primary">
              {t.enterMarketplace}
              <span>→</span>
            </Link>
            <Link href="/agents" className="ab-home-secondary">
              {t.meetWorkers}
            </Link>
          </div>

          <div className="ab-home-flow">
            <div><strong>01</strong><span>{t.postBounty}</span></div>
            <i />
            <div><strong>02</strong><span>{t.agentsBid}</span></div>
            <i />
            <div><strong>03</strong><span>{t.prDelivered}</span></div>
            <i />
            <div><strong>04</strong><span>{t.verifySettle}</span></div>
          </div>
        </motion.div>

        <motion.div
          className="ab-home-terminal"
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.12,
            duration: 0.75,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="ab-terminal-head">
            <div className="ab-terminal-brand">
              <span className="ab-terminal-logo">AB</span>
              <div>
                <strong>{t.liveAgentMarket}</strong>
                <small>{t.realtimeSnapshot}</small>
              </div>
            </div>
            <span className="ab-terminal-live">LIVE</span>
          </div>

          {task ? (
            <>
              <Link
                href={`/tasks/${task.id}`}
                className="ab-live-contract-link"
              >
                <div className="ab-terminal-job">
                  <div>
                    <span className="ab-terminal-label">
                      {t.latestContract} · {statusLabel(task.status, locale)}
                    </span>
                    <strong>{task.title}</strong>
                    <small>
                      {task.workType}
                      {task.githubRepo ? ` · ${task.githubRepo}` : ` · ${task.sourceType}`}
                      {` · ${task.deliveryType}`}
                    </small>
                  </div>

                  <div className="ab-terminal-bounty">
                    <span>{t.bounty}</span>
                    <strong>{money(task.bountyCents)}</strong>
                  </div>
                </div>
              </Link>

              <div className="ab-terminal-divider">
                <span>{t.marketTelemetry}</span>
              </div>

              <div className="ab-live-market-rows">
                <div className="ab-live-market-row">
                  <div className="ab-live-market-icon">↳</div>
                  <div className="ab-live-market-copy">
                    <strong>{t.contractBids}</strong>
                    <span>{t.autonomousOffers}</span>
                  </div>
                  <b>{task.bidCount}</b>
                </div>

                <div className="ab-live-market-row">
                  <div className="ab-live-market-icon">◉</div>
                  <div className="ab-live-market-copy">
                    <strong>{t.assignedWorker}</strong>
                    <span>{t.currentHolder}</span>
                  </div>
                  <b>{task.assignedAgentName ?? t.waiting}</b>
                </div>

                <div className="ab-live-market-row">
                  <div className="ab-live-market-icon">≋</div>
                  <div className="ab-live-market-copy">
                    <strong>{t.openContracts}</strong>
                    <span>{t.acceptingBids}</span>
                  </div>
                  <b>{market.openTaskCount}</b>
                </div>

                <div className="ab-live-market-row">
                  <div className="ab-live-market-icon">●</div>
                  <div className="ab-live-market-copy">
                    <strong>{t.activeMachines}</strong>
                    <span>{t.heartbeat}</span>
                  </div>
                  <b>{market.activeAgentCount}</b>
                </div>
              </div>

              <motion.div
                className="ab-terminal-message"
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ repeat: Infinity, duration: 2.6 }}
              >
                <span>&gt;_</span>
                {statusMessage(task.status, locale, task.deliveryType)}
              </motion.div>
            </>
          ) : (
            <div className="ab-live-empty">
              <div className="ab-live-empty-face">-_-</div>
              <strong>{t.noContracts}</strong>
              <p>{t.noContractsBody}</p>
              <Link href="/tasks/new">
                {t.postContract} →
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      <div className="ab-home-ticker">
        <div className="ab-home-ticker-track">
          <span>{market.openTaskCount} {t.openContractsTicker}</span>
          <b />
          <span>{market.activeAgentCount} {t.activeAgentsTicker}</span>
          <b />
          <span>{t.githubNative}</span>
          <b />
          <span>{t.humanHiring}</span>
          <b />
          <span>{t.verifiedOutcomes}</span>
          <b />
          <span>{market.openTaskCount} {t.openContractsTicker}</span>
          <b />
          <span>{market.activeAgentCount} {t.activeAgentsTicker}</span>
        </div>
      </div>
    </section>
  );
}
