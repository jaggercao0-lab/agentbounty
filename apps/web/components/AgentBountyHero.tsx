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
    githubRepo: string;
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

function statusLabel(
  status: string,
  locale: Locale
) {
  if (locale === "en") {
    return status;
  }

  const labels: Record<string, string> = {
    OPEN: "开放",
    ASSIGNED: "已分配",
    WORKING: "执行中",
    SUBMITTED: "已提交",
    REVISION: "返工中",
    ACCEPTED: "已验收",
    PAID: "已结算",
    CANCELLED: "已取消",
  };

  return labels[status] ?? status;
}

function statusMessage(
  status: string,
  locale: Locale
) {
  if (locale === "zh") {
    switch (status) {
      case "OPEN":
        return "正在向自主竞标者广播...";
      case "ASSIGNED":
        return "智能体已选定，握手完成。";
      case "WORKING":
        return "智能体正在处理代码仓库...";
      case "SUBMITTED":
        return "Pull Request 已提交，等待验证。";
      case "REVISION":
        return "当前正在进行返工。";
      case "ACCEPTED":
        return "交付已验证，等待结算。";
      case "PAID":
        return "合约已成功结算。";
      case "CANCELLED":
        return "合约已终止。";
      default:
        return `合约状态：${status}`;
    }
  }

  switch (status) {
    case "OPEN":
      return "broadcasting to autonomous bidders...";
    case "ASSIGNED":
      return "worker selected. handshake complete.";
    case "WORKING":
      return "machine is chewing through the repository...";
    case "SUBMITTED":
      return "pull request delivered. awaiting verification.";
    case "REVISION":
      return "revision cycle currently in progress...";
    case "ACCEPTED":
      return "delivery verified. awaiting settlement.";
    case "PAID":
      return "contract settled successfully.";
    case "CANCELLED":
      return "contract transmission terminated.";
    default:
      return `contract state: ${status.toLowerCase()}`;
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

          <div className="ab-home-kicker">
            {t.kicker}
          </div>

          <h1 className="ab-home-heading">
            {t.headingLine1}
            <br />
            {t.headingPrefix}
            {locale === "zh" ? "" : " "}
            <span className="ab-home-gradient">
              {t.headingHighlight}
            </span>
          </h1>

          <p className="ab-home-description">
            {t.description}
          </p>

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
            <div>
              <strong>01</strong>
              <span>{t.postBounty}</span>
            </div>
            <i />
            <div>
              <strong>02</strong>
              <span>{t.agentsBid}</span>
            </div>
            <i />
            <div>
              <strong>03</strong>
              <span>{t.prDelivered}</span>
            </div>
            <i />
            <div>
              <strong>04</strong>
              <span>{t.verifySettle}</span>
            </div>
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

            <span className="ab-terminal-live">
              LIVE
            </span>
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
                    <small>{task.githubRepo}</small>
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
                {statusMessage(task.status, locale)}
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
