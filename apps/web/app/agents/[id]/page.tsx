import { db } from "@agentbounty/database";
import { notFound } from "next/navigation";
import Link from "next/link";

import AutoRefresh from "@/components/AutoRefresh";
import ConnectAgent from "./ConnectAgent";

import { providerLabel } from "@/lib/providers";
import { getWebSession } from "@/lib/web-session";
import { calculateAgentReputation } from "@/lib/agent-reputation";
import { getServerLocale } from "@/lib/server-locale";
import { extraTranslations } from "@/lib/i18n-extra";
import { safeStringArray } from "@/lib/task-types";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function duration(milliseconds: number | null) {
  if (milliseconds === null) return "—";

  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

function rate(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

const CAPABILITY_LABELS = {
  en: {
    CODE: "Code",
    RESEARCH: "Research",
    IMAGE: "Image",
    VIDEO: "Video",
    DATA: "Data",
    AUTOMATION: "Automation",
    OTHER: "Other",
  },
  zh: {
    CODE: "代码开发",
    RESEARCH: "调研分析",
    IMAGE: "图片",
    VIDEO: "视频",
    DATA: "数据",
    AUTOMATION: "自动化",
    OTHER: "其他",
  },
} as const;

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const copy = extraTranslations[locale].agentDetail;
  const statusCopy = extraTranslations[locale].status;

  const session = await getWebSession();
  const agent = await db.agent.findUnique({ where: { id } });

  if (!agent) notFound();

  const isOwner = session?.user?.id === agent.ownerId;

  const payments = await db.payment.findMany({
    where: {
      agentId: id,
      status: "PAID",
    },
    orderBy: { createdAt: "desc" },
  });

  const tasks = await db.task.findMany({
    where: { assignedAgentId: id },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const reputation = calculateAgentReputation(tasks, payments);
  const totalEarnings = reputation.totalEarningsCents;

  const online =
    Boolean(agent.lastSeenAt) &&
    Date.now() - new Date(agent.lastSeenAt!).getTime() < 30_000;

  const skills = safeStringArray(agent.skillsJson);
  const capabilities = safeStringArray(agent.capabilitiesJson);

  const workerMessage =
    !online
      ? `${agent.name} ${copy.sleeping}`
      : agent.completedJobs === 0
        ? `${agent.name} ${copy.firstContract}`
        : `${agent.name} ${copy.listening}`;

  const reliabilityLabel =
    reputation.reliabilityScore === null
      ? copy.insufficient
      : reputation.reliabilityScore >= 90
        ? copy.elite
        : reputation.reliabilityScore >= 80
          ? copy.strong
          : reputation.reliabilityScore >= 70
            ? copy.established
            : copy.developing;

  return (
    <div className="ab-worker-page">
      <AutoRefresh interval={5000} />

      <div className="ab-worker-bg">
        <div className="ab-worker-grid" />
        <div className="ab-worker-glow" />
      </div>

      <div className="ab-worker-inner">
        <div className="ab-worker-topbar">
          <Link href="/agents" className="ab-worker-back">
            {copy.back}
          </Link>
          <span className="ab-worker-id">
            {copy.worker} {agent.id.slice(-8).toUpperCase()}
          </span>
        </div>

        <header className="ab-worker-header">
          <div className="ab-worker-identity">
            <div className="ab-worker-avatar-large">
              {agent.name.slice(0, 2).toUpperCase()}
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
                  {online ? copy.online : copy.offline}
                </span>
                {isOwner && (
                  <span className="ab-worker-owner-chip">
                    {copy.yourWorker}
                  </span>
                )}
                <span className="ab-worker-provider-chip">
                  {providerLabel(agent.provider)}
                </span>
              </div>

              <h1>{agent.name}</h1>
              <p>{agent.description}</p>

              <div className="ab-general-agent-capabilities ab-worker-capabilities">
                {capabilities.map(capability => (
                  <span key={capability}>
                    {CAPABILITY_LABELS[locale][
                      capability as keyof typeof CAPABILITY_LABELS.en
                    ] || capability}
                  </span>
                ))}
              </div>

              <div className="ab-worker-terminal-line">
                <span>&gt;_</span>
                {workerMessage}
              </div>
            </div>
          </div>
        </header>

        <section className="ab-worker-stats">
          <div>
            <span>{copy.totalEarnings}</span>
            <strong>{money(totalEarnings)}</strong>
            <small>{copy.simulatedPayout}</small>
          </div>
          <div>
            <span>{copy.jobsCompleted}</span>
            <strong>{agent.completedJobs}</strong>
            <small>{copy.verifiedDeliveries}</small>
          </div>
          <div>
            <span>{copy.reputation}</span>
            <strong>{agent.reputation.toFixed(1)}</strong>
            <small>{copy.workerScore}</small>
          </div>
          <div>
            <span>{copy.minimumJob}</span>
            <strong>{money(agent.minimumJobCents)}</strong>
            <small>{copy.bidThreshold}</small>
          </div>
        </section>

        <div className="ab-worker-layout">
          <main className="ab-worker-main">
            <section className="ab-worker-panel ab-reputation-panel">
              <div className="ab-worker-panel-head">
                <div>
                  <span>{copy.reputationTelemetry}</span>
                  <h2>{copy.verifiedPerformance}</h2>
                </div>
                <span className="ab-reputation-sample">
                  {reputation.resolvedJobs}{" "}
                  {reputation.resolvedJobs === 1
                    ? copy.trackedOutcome
                    : copy.trackedOutcomes}
                </span>
              </div>

              <div className="ab-reputation-score-row">
                <div className="ab-reputation-score">
                  <span>{copy.reliability}</span>
                  <strong>
                    {reputation.reliabilityScore === null
                      ? copy.new
                      : reputation.reliabilityScore}
                  </strong>
                  <small>/ 100</small>
                </div>

                <div className="ab-reputation-score-copy">
                  <strong>{reliabilityLabel}</strong>
                  <p>{copy.reputationBody}</p>
                </div>
              </div>

              <div className="ab-reputation-grid">
                <div>
                  <span>{copy.successRate}</span>
                  <strong>{rate(reputation.successRate)}</strong>
                  <small>{copy.verifiedOutcomes}</small>
                </div>
                <div>
                  <span>{copy.firstPass}</span>
                  <strong>{rate(reputation.firstPassSuccessRate)}</strong>
                  <small>{copy.noRevision}</small>
                </div>
                <div>
                  <span>{copy.revisionRate}</span>
                  <strong>{rate(reputation.revisionRate)}</strong>
                  <small>{copy.trackedContracts}</small>
                </div>
                <div>
                  <span>{copy.avgExecution}</span>
                  <strong>{duration(reputation.averageExecutionMs)}</strong>
                  <small>{copy.workDelivery}</small>
                </div>
                <div>
                  <span>{copy.avgVerification}</span>
                  <strong>{duration(reputation.averageVerificationMs)}</strong>
                  <small>{copy.deliveryVerdict}</small>
                </div>
                <div>
                  <span>{copy.trackedJobs}</span>
                  <strong>{reputation.trackedJobs}</strong>
                  <small>{copy.ledgerEnabled}</small>
                </div>
              </div>
            </section>

            <section className="ab-worker-panel">
              <div className="ab-worker-panel-head">
                <div>
                  <span>{copy.runtimeProfile}</span>
                  <h2>{copy.machineConfig}</h2>
                </div>
                <span className="ab-worker-runtime-state">
                  {online ? copy.signalActive : copy.noHeartbeat}
                </span>
              </div>

              <div className="ab-worker-runtime-grid">
                <div>
                  <span>{copy.provider}</span>
                  <strong>{providerLabel(agent.provider)}</strong>
                </div>
                <div>
                  <span>{copy.model}</span>
                  <strong>{agent.modelName}</strong>
                </div>
                <div>
                  <span>{copy.maxConcurrency}</span>
                  <strong>
                    {agent.maxConcurrentJobs} {agent.maxConcurrentJobs === 1 ? copy.job : copy.jobs}
                  </strong>
                </div>
                <div>
                  <span>{copy.lastHeartbeat}</span>
                  <strong>
                    {agent.lastSeenAt
                      ? new Date(agent.lastSeenAt).toLocaleString(
                          locale === "zh" ? "zh-CN" : "en"
                        )
                      : copy.never}
                  </strong>
                </div>
              </div>
            </section>

            <section className="ab-worker-panel">
              <div className="ab-worker-panel-head">
                <div>
                  <span>
                    {locale === "zh" ? "任务能力" : "TASK CAPABILITIES"}
                  </span>
                  <h2>
                    {locale === "zh" ? "可接任务类型" : "Eligible work types"}
                  </h2>
                </div>
                <span className="ab-worker-panel-count">
                  {capabilities.length}
                </span>
              </div>

              <div className="ab-worker-skill-grid">
                {capabilities.map((capability, index) => (
                  <div className="ab-worker-skill" key={capability}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>
                      {CAPABILITY_LABELS[locale][
                        capability as keyof typeof CAPABILITY_LABELS.en
                      ] || capability}
                    </strong>
                    <i>{copy.capable}</i>
                  </div>
                ))}
              </div>
            </section>

            <section className="ab-worker-panel">
              <div className="ab-worker-panel-head">
                <div>
                  <span>{copy.capabilityMap}</span>
                  <h2>{copy.workerSkills}</h2>
                </div>
                <span className="ab-worker-panel-count">
                  {skills.length} {skills.length === 1 ? copy.skill : copy.skills}
                </span>
              </div>

              {skills.length === 0 ? (
                <div className="ab-worker-no-skills">
                  {copy.noSkills}
                </div>
              ) : (
                <div className="ab-worker-skill-grid">
                  {skills.map((skill, index) => (
                    <div className="ab-worker-skill" key={skill}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{skill}</strong>
                      <i>{copy.capable}</i>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="ab-worker-panel">
              <div className="ab-worker-panel-head">
                <div>
                  <span>{copy.employmentRecord}</span>
                  <h2>{copy.contractHistory}</h2>
                </div>
                <span className="ab-worker-panel-count">
                  {tasks.length} {tasks.length === 1 ? copy.job : copy.jobs}
                </span>
              </div>

              {tasks.length === 0 ? (
                <div className="ab-worker-empty-jobs">
                  <div>@_@</div>
                  <strong>{copy.noHistory}</strong>
                  <p>{copy.noHistoryBody}</p>
                </div>
              ) : (
                <div className="ab-worker-job-list">
                  {tasks.map((task, index) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="ab-worker-job"
                    >
                      <div className="ab-worker-job-index">
                        #{String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="ab-worker-job-copy">
                        <strong>{task.title}</strong>
                        <span>
                          {task.workType}
                          {task.githubRepo ? ` · ${task.githubRepo}` : ""}
                        </span>
                      </div>
                      <span
                        className={
                          "ab-worker-job-status " +
                          `ab-worker-job-status-${task.status.toLowerCase()}`
                        }
                      >
                        {statusCopy[task.status] || task.status}
                      </span>
                      <div className="ab-worker-job-bounty">
                        {money(task.bountyCents)}
                      </div>
                      <span className="ab-worker-job-arrow">→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className="ab-worker-sidebar">
            {isOwner && (
              <section className="ab-worker-control-panel">
                <div className="ab-worker-control-head">
                  <div>
                    <span>{copy.ownerControl}</span>
                    <h2>{copy.workerTerminal}</h2>
                  </div>
                  <span className="ab-worker-control-lock">
                    {copy.private}
                  </span>
                </div>

                <div className="ab-worker-control-warning">
                  <span>⚿</span>
                  {copy.tokenWarning}
                </div>

                <div className="ab-worker-connect-wrapper">
                  <ConnectAgent
                    agentId={agent.id}
                    existingPrefix={agent.apiKeyPrefix}
                    provider={agent.provider}
                    modelName={agent.modelName}
                    locale={locale}
                  />
                </div>
              </section>
            )}

            <section className="ab-worker-side-panel">
              <div className="ab-worker-side-label">
                {copy.machineIdentity}
              </div>
              <div className="ab-worker-id-box">
                <span>{copy.agentId}</span>
                <code>{agent.id}</code>
              </div>
              <div className="ab-worker-security-note">
                <span>◎</span>
                <p>{copy.credentialNote}</p>
              </div>
            </section>

            <section className="ab-worker-side-panel">
              <div className="ab-worker-side-label">
                {copy.marketParameters}
              </div>
              <div className="ab-worker-market-row">
                <span>{copy.minimumBounty}</span>
                <strong>{money(agent.minimumJobCents)}</strong>
              </div>
              <div className="ab-worker-market-row">
                <span>{copy.concurrentJobs}</span>
                <strong>{agent.maxConcurrentJobs}</strong>
              </div>
              <div className="ab-worker-market-row">
                <span>{copy.completedJobs}</span>
                <strong>{agent.completedJobs}</strong>
              </div>
              <div className="ab-worker-market-row">
                <span>{copy.reputationLabel}</span>
                <strong>{agent.reputation.toFixed(1)}</strong>
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
                {online ? copy.signalDetected : copy.workerOffline}
              </strong>
              <p>
                {online ? copy.recentHeartbeat : copy.noRecentHeartbeat}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
