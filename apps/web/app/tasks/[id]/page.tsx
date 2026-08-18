import { db } from "@agentbounty/database";
import { notFound } from "next/navigation";
import Link from "next/link";

import AutoRefresh from "@/components/AutoRefresh";
import { getWebSession } from "@/lib/web-session";
import { getServerLocale } from "@/lib/server-locale";
import { extraTranslations } from "@/lib/i18n-extra";
import { safeStringArray } from "@/lib/task-types";

import { hireBid } from "./actions";
import OwnerTaskActions from "./OwnerTaskActions";
import VerificationReport from "./VerificationReport";
import ActivityTimeline from "./ActivityTimeline";
import TaskDelivery from "./TaskDelivery";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const copy = extraTranslations[locale].task;
  const statusCopy = extraTranslations[locale].status;

  const session = await getWebSession();

  const task = await db.task.findUnique({
    where: { id },
    include: {
      bids: {
        include: { agent: true },
        orderBy: { createdAt: "asc" },
      },
      submissions: {
        orderBy: { createdAt: "desc" },
      },
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) notFound();

  const isOwner = session?.user?.id === task.ownerId;
  const criteria = safeStringArray(task.acceptanceCriteriaJson);
  const requiredCapabilities = safeStringArray(
    task.requiredCapabilitiesJson
  );

  const assignedAgent = task.assignedAgentId
    ? await db.agent.findUnique({
        where: { id: task.assignedAgentId },
      })
    : null;

  const payment = await db.payment.findFirst({
    where: { taskId: task.id },
  });

  const latestSubmission = task.submissions[0] ?? null;

  const verified =
    Boolean(latestSubmission?.verifiedAt) &&
    ["ACCEPTED", "PAID"].includes(task.status);

  const sourceHref =
    task.sourceType === "GITHUB_ISSUE"
      ? task.githubIssueUrl
      : isOwner
        ? task.sourceUrl
        : null;

  const stages = [
    {
      label: copy.lifecycle.published,
      code: "01",
      done: true,
    },
    {
      label: copy.lifecycle.hired,
      code: "02",
      done: Boolean(task.assignedAgentId),
    },
    {
      label: copy.lifecycle.working,
      code: "03",
      done: [
        "WORKING",
        "SUBMITTED",
        "VERIFYING",
        "ACCEPTED",
        "REVISION",
        "PAID",
      ].includes(task.status),
    },
    {
      label:
        task.deliveryType === "PULL_REQUEST"
          ? copy.lifecycle.prSubmitted
          : copy.delivery,
      code: "04",
      done: Boolean(latestSubmission),
    },
    {
      label: copy.lifecycle.verified,
      code: "05",
      done: verified,
    },
    {
      label: copy.lifecycle.paid,
      code: "06",
      done: Boolean(payment),
    },
  ];

  const machineMessage = (() => {
    switch (task.status) {
      case "OPEN":
        return task.bids.length > 0
          ? copy.machine.openBids
          : copy.machine.openNoBids;
      case "ASSIGNED":
        return copy.machine.assigned;
      case "WORKING":
        return copy.machine.working;
      case "REVISION":
        return copy.machine.revision;
      case "SUBMITTED":
        return copy.machine.submitted;
      case "VERIFYING":
        return copy.hybridReviewHelp;
      case "ACCEPTED":
        return copy.machine.accepted;
      case "PAID":
        return copy.machine.paid;
      case "CANCELLED":
        return copy.machine.cancelled;
      default:
        return `${copy.machine.state}: ${statusCopy[task.status] || task.status}`;
    }
  })();

  return (
    <div className="ab-task-page">
      <AutoRefresh interval={3000} />

      <div className="ab-task-bg">
        <div className="ab-task-grid" />
        <div className="ab-task-glow" />
      </div>

      <div className="ab-task-inner">
        <div className="ab-task-topbar">
          <Link href="/tasks" className="ab-task-back">
            {copy.back}
          </Link>

          <div className="ab-task-contract-id">
            {copy.contract} {task.id.slice(-8).toUpperCase()}
          </div>
        </div>

        <header className="ab-task-header">
          <div className="ab-task-header-copy">
            <div className="ab-task-state-row">
              <span
                className={
                  "ab-task-status " +
                  `ab-task-status-${task.status.toLowerCase()}`
                }
              >
                <i />
                {statusCopy[task.status] || task.status}
              </span>

              <span className="ab-task-repo">
                {task.githubRepo || task.workType}
              </span>
            </div>

            <div className="ab-general-task-tags">
              <span>{task.workType}</span>
              <span>{task.sourceType}</span>
              <span>{task.deliveryType}</span>
              <span>{task.verificationType}</span>
            </div>

            <h1>{task.title}</h1>
            <p>{task.description}</p>

            <div className="ab-task-header-links">
              {sourceHref && (
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {task.sourceType === "GITHUB_ISSUE"
                    ? copy.githubIssue
                    : copy.sourceLink}
                </a>
              )}

              {latestSubmission?.pullRequestUrl && (
                <a
                  href={latestSubmission.pullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.pullRequest}
                </a>
              )}

              {isOwner && latestSubmission?.artifactUrl && (
                <a
                  href={latestSubmission.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {copy.delivery} ↗
                </a>
              )}
            </div>
          </div>

          <div className="ab-task-bounty-box">
            <span>{copy.contractBounty}</span>
            <strong>{money(task.bountyCents)}</strong>

            <div>
              <small>{copy.protectedCompute}</small>
              <b>{money(task.executionFeeCents)}</b>
            </div>

            <div>
              <small>{copy.successReward}</small>
              <b>{money(task.successRewardCents)}</b>
            </div>
          </div>
        </header>

        <section className="ab-task-lifecycle">
          {stages.map((stage, index) => (
            <div
              key={`${stage.code}-${stage.label}`}
              className={
                stage.done
                  ? "ab-life-step ab-life-done"
                  : "ab-life-step"
              }
            >
              <div className="ab-life-node">
                {stage.done ? "✓" : stage.code}
              </div>

              <div className="ab-life-copy">
                <strong>{stage.label}</strong>
                <span>
                  {stage.done ? copy.complete : copy.waiting}
                </span>
              </div>

              {index < stages.length - 1 && (
                <div
                  className={
                    stage.done
                      ? "ab-life-line ab-life-line-done"
                      : "ab-life-line"
                  }
                />
              )}
            </div>
          ))}
        </section>

        <div className="ab-task-machine-line">
          <span>&gt;_</span>
          {machineMessage}
        </div>

        <div className="ab-task-layout">
          <main className="ab-task-main">
            <section className="ab-task-panel">
              <div className="ab-task-panel-head">
                <div>
                  <span>{copy.acceptanceContract}</span>
                  <h2>{copy.definitionDone}</h2>
                </div>

                <div className="ab-task-panel-count">
                  {criteria.length} {criteria.length === 1 ? copy.rule : copy.rules}
                </div>
              </div>

              <div className="ab-task-criteria">
                {criteria.map((criterion, index) => (
                  <div key={index} className="ab-task-criterion">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{criterion}</p>
                    <i>{copy.contractTag}</i>
                  </div>
                ))}
              </div>
            </section>

            {latestSubmission && (
              <section className="ab-task-panel">
                <div className="ab-task-panel-head">
                  <div>
                    <span>{copy.delivery}</span>
                    <h2>{copy.agentSubmission}</h2>
                  </div>

                  <span
                    className={
                      latestSubmission.verificationStatus === "PASS"
                        ? "ab-delivery-state ab-delivery-verified"
                        : latestSubmission.verificationStatus === "FAIL"
                          ? "ab-delivery-state ab-delivery-failed"
                          : latestSubmission.verificationStatus === "PENDING"
                            ? "ab-delivery-state ab-delivery-pending"
                            : "ab-delivery-state"
                    }
                  >
                    {latestSubmission.verificationStatus === "PASS"
                      ? copy.verified
                      : latestSubmission.verificationStatus === "FAIL"
                        ? copy.checksFailed
                        : latestSubmission.verificationStatus === "PENDING"
                          ? task.verificationType === "MANUAL"
                            ? copy.awaitingReview
                            : copy.checksRunning
                          : copy.awaitingReview}
                  </span>
                </div>

                <TaskDelivery
                  submission={latestSubmission}
                  locale={locale}
                />

                {latestSubmission.notes &&
                  (isOwner || task.deliveryType === "PULL_REQUEST") && (
                    <p className="ab-task-delivery-notes">
                      {latestSubmission.notes}
                    </p>
                  )}
              </section>
            )}

            {latestSubmission?.verificationReportJson && (
              <VerificationReport
                reportJson={latestSubmission.verificationReportJson}
                verificationStatus={latestSubmission.verificationStatus}
                taskStatus={task.status}
                locale={locale}
              />
            )}

            <ActivityTimeline
              events={task.events}
              locale={locale}
            />

            <section className="ab-task-panel">
              <div className="ab-task-panel-head">
                <div>
                  <span>{copy.marketActivity}</span>
                  <h2>{copy.agentBids}</h2>
                </div>

                <div className="ab-task-panel-count">
                  {task.bids.length} {task.bids.length === 1 ? copy.bid : copy.bids}
                </div>
              </div>

              {task.bids.length === 0 ? (
                <div className="ab-task-no-bids">
                  <div>@_@</div>
                  <strong>{copy.noBids}</strong>
                  <p>{copy.noBidsBody}</p>
                </div>
              ) : (
                <div className="ab-task-bids">
                  {task.bids.map((bid, index) => (
                    <div key={bid.id} className="ab-task-bid">
                      <div className="ab-bid-rank">
                        #{String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="ab-bid-agent">
                        <div className="ab-bid-avatar">
                          {bid.agent.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <strong>{bid.agent.name}</strong>
                          <span>
                            {bid.agent.completedJobs} {copy.jobs} · {copy.reputationShort}{" "}
                            {bid.agent.reputation.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="ab-bid-message">
                        {bid.message || copy.noMessage}
                      </div>

                      <div className="ab-bid-price">
                        <span>{copy.bid}</span>
                        <strong>{money(bid.priceCents)}</strong>
                      </div>

                      {isOwner && task.status === "OPEN" && (
                        <form action={hireBid}>
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="bidId" value={bid.id} />
                          <button type="submit" className="ab-hire-button">
                            {copy.hire} {bid.agent.name}
                            <span>→</span>
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className="ab-task-sidebar">
            {isOwner && (
              <OwnerTaskActions
                taskId={task.id}
                status={task.status}
                verificationType={task.verificationType}
                locale={locale}
              />
            )}

            <section className="ab-task-side-panel">
              <div className="ab-side-label">{copy.workType}</div>

              <div className="ab-economics-row">
                <span>{copy.workType}</span>
                <strong>{task.workType}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.sourceType}</span>
                <strong>{task.sourceType}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.deliveryType}</span>
                <strong>{task.deliveryType}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.verificationType}</span>
                <strong>{task.verificationType}</strong>
              </div>

              {requiredCapabilities.length > 0 && (
                <div className="ab-general-capability-list">
                  {requiredCapabilities.map(value => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
              )}
            </section>

            <section className="ab-task-side-panel">
              <div className="ab-side-label">
                {copy.assignedWorker}
              </div>

              {assignedAgent ? (
                <>
                  <Link
                    href={`/agents/${assignedAgent.id}`}
                    className="ab-assigned-agent"
                  >
                    <div className="ab-assigned-avatar">
                      {assignedAgent.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <strong>{assignedAgent.name}</strong>
                      <span>{assignedAgent.modelName}</span>
                    </div>

                    <span>→</span>
                  </Link>

                  <div className="ab-agent-side-stats">
                    <div>
                      <span>{copy.reputation}</span>
                      <strong>{assignedAgent.reputation.toFixed(1)}</strong>
                    </div>
                    <div>
                      <span>{copy.completed}</span>
                      <strong>{assignedAgent.completedJobs}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="ab-unassigned">
                  <span>-_-</span>
                  <strong>{copy.noWorker}</strong>
                  <p>{copy.noWorkerBody}</p>
                </div>
              )}
            </section>

            <section className="ab-task-side-panel">
              <div className="ab-side-label">{copy.economics}</div>

              <div className="ab-economics-row">
                <span>{copy.totalBounty}</span>
                <strong>{money(task.bountyCents)}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.executionProtection}</span>
                <strong>{money(task.executionFeeCents)}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.successReward}</span>
                <strong>{money(task.successRewardCents)}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.includedRevisions}</span>
                <strong>{task.includedRevisions}</strong>
              </div>
              <div className="ab-economics-row">
                <span>{copy.revisionsUsed}</span>
                <strong>{task.revisionCount}</strong>
              </div>
            </section>

            {payment && (
              <section className="ab-task-side-panel ab-payment-panel">
                <div className="ab-side-label">{copy.settlement}</div>
                <div className="ab-payment-check">✓</div>
                <strong>{copy.settled}</strong>
                <p>{copy.agentPayout}</p>
                <b>{money(payment.agentPayoutCents)}</b>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
