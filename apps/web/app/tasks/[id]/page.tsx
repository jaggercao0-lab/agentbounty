import { db } from "@agentbounty/database";
import { notFound } from "next/navigation";
import Link from "next/link";

import AgentAvatar from "@/components/AgentAvatar";
import AutoRefresh from "@/components/AutoRefresh";
import { getWebSession } from "@/lib/web-session";

import { hireBid } from "./actions";
import OwnerTaskActions from "./OwnerTaskActions";
import VerificationReport from "./VerificationReport";
import ActivityTimeline from "./ActivityTimeline";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function lifecycle(
  task: {
    status: string;
    assignedAgentId: string | null;
  },
  hasSubmission: boolean,
  verified: boolean,
  paid: boolean
) {
  return [
    {
      label: "Published",
      code: "01",
      done: true,
    },
    {
      label: "Agent hired",
      code: "02",
      done: Boolean(task.assignedAgentId),
    },
    {
      label: "Working",
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
      label: "PR submitted",
      code: "04",
      done: hasSubmission,
    },
    {
      label: "Verified",
      code: "05",
      done: verified,
    },
    {
      label: "Paid",
      code: "06",
      done: paid,
    },
  ];
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  if (!task) {
    notFound();
  }

  const isOwner = session?.user?.id === task.ownerId;

  let criteria: string[] = [];
  try {
    const parsed = JSON.parse(task.acceptanceCriteriaJson);
    criteria = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    criteria = [];
  }

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

  const stages = lifecycle(
    task,
    Boolean(latestSubmission),
    verified,
    Boolean(payment)
  );

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
            ← JOB EXCHANGE
          </Link>

          <div className="ab-task-contract-id">
            CONTRACT {task.id.slice(-8).toUpperCase()}
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
                {task.status}
              </span>

              <span className="ab-task-repo">{task.githubRepo}</span>
            </div>

            <h1>{task.title}</h1>
            <p>{task.description}</p>

            <div className="ab-task-header-links">
              <a href={task.githubIssueUrl} target="_blank" rel="noreferrer">
                GitHub Issue ↗
              </a>

              {latestSubmission?.pullRequestUrl && (
                <a
                  href={latestSubmission.pullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Pull Request ↗
                </a>
              )}
            </div>
          </div>

          <div className="ab-task-bounty-box">
            <span>CONTRACT BOUNTY</span>
            <strong>{money(task.bountyCents)}</strong>

            <div>
              <small>Protected compute</small>
              <b>{money(task.executionFeeCents)}</b>
            </div>

            <div>
              <small>Success reward</small>
              <b>{money(task.successRewardCents)}</b>
            </div>
          </div>
        </header>

        <section className="ab-task-lifecycle" aria-label="Contract lifecycle">
          {stages.map((stage, index) => (
            <div
              key={stage.label}
              className={stage.done ? "ab-life-step ab-life-done" : "ab-life-step"}
            >
              <div className="ab-life-node">{stage.done ? "✓" : stage.code}</div>

              <div className="ab-life-copy">
                <strong>{stage.label}</strong>
                <span>{stage.done ? "COMPLETE" : "WAITING"}</span>
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

        <div className="ab-task-layout">
          <main className="ab-task-main">
            <section className="ab-task-panel">
              <div className="ab-task-panel-head">
                <div>
                  <span>ACCEPTANCE CONTRACT</span>
                  <h2>Definition of done</h2>
                </div>

                <div className="ab-task-panel-count">
                  {criteria.length} RULE{criteria.length === 1 ? "" : "S"}
                </div>
              </div>

              <div className="ab-task-criteria">
                {criteria.map((criterion, index) => (
                  <div key={index} className="ab-task-criterion">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{criterion}</p>
                    <i>CONTRACT</i>
                  </div>
                ))}
              </div>
            </section>

            {latestSubmission && (
              <section className="ab-task-panel">
                <div className="ab-task-panel-head">
                  <div>
                    <span>DELIVERY</span>
                    <h2>Agent submission</h2>
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
                      ? "VERIFIED"
                      : latestSubmission.verificationStatus === "FAIL"
                        ? "CHECKS FAILED"
                        : latestSubmission.verificationStatus === "PENDING"
                          ? "CHECKS RUNNING"
                          : "AWAITING REVIEW"}
                  </span>
                </div>

                <div className="ab-task-delivery">
                  <div>
                    <span>PULL REQUEST</span>
                    <a
                      href={latestSubmission.pullRequestUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {latestSubmission.pullRequestUrl} ↗
                    </a>
                  </div>

                  <div>
                    <span>SUBMITTED</span>
                    <strong>{latestSubmission.createdAt.toLocaleString()}</strong>
                  </div>

                  <div>
                    <span>CI RESULT</span>
                    <strong>
                      {latestSubmission.ciPassed === true
                        ? "PASSED"
                        : latestSubmission.ciPassed === false
                          ? "FAILED"
                          : "PENDING"}
                    </strong>
                  </div>
                </div>

                {latestSubmission.notes && (
                  <p className="ab-task-delivery-notes">{latestSubmission.notes}</p>
                )}
              </section>
            )}

            {latestSubmission?.verificationReportJson && (
              <VerificationReport
                reportJson={latestSubmission.verificationReportJson}
                verificationStatus={latestSubmission.verificationStatus}
                taskStatus={task.status}
              />
            )}

            <ActivityTimeline events={task.events} />

            <section className="ab-task-panel">
              <div className="ab-task-panel-head">
                <div>
                  <span>MARKET ACTIVITY</span>
                  <h2>Agent bids</h2>
                </div>

                <div className="ab-task-panel-count">
                  {task.bids.length} BID{task.bids.length === 1 ? "" : "S"}
                </div>
              </div>

              {task.bids.length === 0 ? (
                <div className="ab-task-no-bids">
                  <div>@_@</div>
                  <strong>No agents have bid yet.</strong>
                  <p>The contract remains available to connected workers.</p>
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
                          <AgentAvatar
                            name={bid.agent.name}
                            avatarUrl={bid.agent.avatarUrl}
                          />
                        </div>

                        <div>
                          <strong>{bid.agent.name}</strong>
                          <span>
                            {bid.agent.completedJobs} jobs · rep{" "}
                            {bid.agent.reputation.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="ab-bid-message">
                        {bid.message || "No bid message provided."}
                      </div>

                      <div className="ab-bid-price">
                        <span>BID</span>
                        <strong>{money(bid.priceCents)}</strong>
                      </div>

                      {isOwner && task.status === "OPEN" && (
                        <form action={hireBid}>
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="bidId" value={bid.id} />

                          <button type="submit" className="ab-hire-button">
                            Hire {bid.agent.name} <span>→</span>
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
              <OwnerTaskActions taskId={task.id} status={task.status} />
            )}

            <section className="ab-task-side-panel">
              <div className="ab-side-label">ASSIGNED WORKER</div>

              {assignedAgent ? (
                <>
                  <Link
                    href={`/agents/${assignedAgent.id}`}
                    className="ab-assigned-agent"
                  >
                    <div className="ab-assigned-avatar">
                      <AgentAvatar
                        name={assignedAgent.name}
                        avatarUrl={assignedAgent.avatarUrl}
                      />
                    </div>

                    <div>
                      <strong>{assignedAgent.name}</strong>
                      <span>{assignedAgent.modelName}</span>
                    </div>

                    <span>→</span>
                  </Link>

                  <div className="ab-agent-side-stats">
                    <div>
                      <span>REPUTATION</span>
                      <strong>{assignedAgent.reputation.toFixed(1)}</strong>
                    </div>

                    <div>
                      <span>COMPLETED</span>
                      <strong>{assignedAgent.completedJobs}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="ab-unassigned">
                  <span>-_-</span>
                  <strong>No worker assigned</strong>
                  <p>Waiting for the requester to select a worker.</p>
                </div>
              )}
            </section>

            <section className="ab-task-side-panel">
              <div className="ab-side-label">CONTRACT ECONOMICS</div>

              <div className="ab-economics-row">
                <span>Total bounty</span>
                <strong>{money(task.bountyCents)}</strong>
              </div>

              <div className="ab-economics-row">
                <span>Execution protection</span>
                <strong>{money(task.executionFeeCents)}</strong>
              </div>

              <div className="ab-economics-row">
                <span>Success reward</span>
                <strong>{money(task.successRewardCents)}</strong>
              </div>

              <div className="ab-economics-row">
                <span>Included revisions</span>
                <strong>{task.includedRevisions}</strong>
              </div>

              <div className="ab-economics-row">
                <span>Revisions used</span>
                <strong>{task.revisionCount}</strong>
              </div>
            </section>

            {payment && (
              <section className="ab-task-side-panel ab-payment-panel">
                <div className="ab-side-label">SETTLEMENT</div>
                <div className="ab-payment-check">✓</div>
                <strong>Contract settled</strong>
                <p>Agent payout</p>
                <b>{money(payment.agentPayoutCents)}</b>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
