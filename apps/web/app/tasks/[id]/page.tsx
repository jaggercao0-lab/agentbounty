import { db } from "@agentbounty/database";
import { notFound } from "next/navigation";
import { hireBid } from "./actions";
import AutoRefresh from "@/components/AutoRefresh";
import { getWebSession } from "@/lib/web-session";
import OwnerTaskActions from "./OwnerTaskActions";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;

  const session =
    await getWebSession();

  const task = await db.task.findUnique({
    where: { id },
    include: {
      bids: {
        include: {
          agent: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      submissions: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!task) {
    notFound();
  }

  const isOwner =
    session?.user?.id ===
    task.ownerId;

  const criteria =
    JSON.parse(task.acceptanceCriteriaJson) as string[];

  const assignedAgent =
    task.assignedAgentId
      ? await db.agent.findUnique({
          where: {
            id: task.assignedAgentId
          }
        })
      : null;

  const payment = await db.payment.findFirst({
    where: {
      taskId: task.id
    }
  });

  const latestSubmission =
    task.submissions[0] || null;

  const stage = {
    published: true,
    bidReceived: task.bids.length > 0,
    hired: !!task.assignedAgentId,
    working: [
      "WORKING",
      "SUBMITTED",
      "ACCEPTED",
      "PAID",
      "REVISION"
    ].includes(task.status),
    submitted: !!latestSubmission,
    verified:
      !!latestSubmission?.verifiedAt &&
      ["ACCEPTED", "PAID"].includes(task.status),
    paid: !!payment
  };

  return (
    <section>
      <AutoRefresh interval={3000} />

      <a href="/tasks" className="back-link">
        ← Marketplace
      </a>

      <div className="task-header">

        <div>
          <span className="badge">
            {task.status}
          </span>

          <h1 className="task-title">
            {task.title}
          </h1>

          <p className="muted">
            {task.githubRepo}
          </p>
        </div>

        <div className="task-money-box">
          <div className="money">
            ${(task.bountyCents / 100).toFixed(2)}
          </div>

          <div className="muted">
            ${(task.executionFeeCents / 100).toFixed(2)}
            {" "}compute protection
          </div>

          <div className="muted">
            ${(task.successRewardCents / 100).toFixed(2)}
            {" "}success reward
          </div>
        </div>

      </div>

      <div className="task-timeline">
        {[
          ["Published", stage.published],
          ["Bid received", stage.bidReceived],
          ["Agent hired", stage.hired],
          ["Working", stage.working],
          ["PR submitted", stage.submitted],
          ["Verified", stage.verified],
          ["Paid", stage.paid]
        ].map(([label, done], index, all) => (
          <div className="timeline-item" key={String(label)}>
            <div className={
              done
                ? "timeline-dot done"
                : "timeline-dot"
            }>
              {done ? "✓" : ""}
            </div>

            <span className={
              done
                ? "timeline-label done"
                : "timeline-label"
            }>
              {String(label)}
            </span>

            {index < all.length - 1 && (
              <div className={
                done
                  ? "timeline-line done"
                  : "timeline-line"
              } />
            )}
          </div>
        ))}
      </div>

      <div className="detail-grid">

        <div>

          <div className="panel">
            <div className="eyebrow">
              Description
            </div>

            <p className="detail-text">
              {task.description}
            </p>

            <a
              href={task.githubIssueUrl}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              View GitHub Issue ↗
            </a>
          </div>

          <div className="panel">
            <div className="eyebrow">
              Acceptance contract
            </div>

            <ul className="criteria big">
              {criteria.map((criterion, index) => (
                <li key={index}>
                  {criterion}
                </li>
              ))}
            </ul>

            <p className="muted">
              {task.includedRevisions} included revision
              {task.includedRevisions === 1 ? "" : "s"}.
            </p>
          </div>

          {task.submissions.length > 0 && (
            <div className="panel">
              <div className="eyebrow">
                Latest delivery
              </div>

              <a
                className="text-link"
                href={
                  task.submissions[0].pullRequestUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                View Pull Request ↗
              </a>

              {task.submissions[0].notes && (
                <p className="muted">
                  {task.submissions[0].notes}
                </p>
              )}
            </div>
          )}

        </div>

        <aside>

          {assignedAgent && (
            <div className="panel agent-selected">
              <div className="eyebrow">
                Assigned agent
              </div>

              <div className="agent-name-row">
                <h2>{assignedAgent.name}</h2>

                <span className={
                  assignedAgent.lastSeenAt &&
                  Date.now() -
                    new Date(assignedAgent.lastSeenAt).getTime()
                    < 30000
                    ? "online-pill"
                    : "offline-pill"
                }>
                  {assignedAgent.lastSeenAt &&
                  Date.now() -
                    new Date(assignedAgent.lastSeenAt).getTime()
                    < 30000
                    ? "● Online"
                    : "● Offline"}
                </span>
              </div>

              <p className="muted">
                {assignedAgent.description}
              </p>

              <div className="agent-stat">
                Completed jobs
                <strong>
                  {assignedAgent.completedJobs}
                </strong>
              </div>

              <div className="agent-stat">
                Reputation
                <strong>
                  {assignedAgent.reputation.toFixed(1)}
                </strong>
              </div>
            </div>
          )}

          {isOwner && (
            <OwnerTaskActions
              taskId={task.id}
              status={task.status}
            />
          )}

          <div className="panel">

            <div className="bid-heading">
              <div>
                <div className="eyebrow">
                  Agent bids
                </div>

                <h2>
                  {task.bids.length} bid
                  {task.bids.length === 1 ? "" : "s"}
                </h2>
              </div>
            </div>

            {task.bids.length === 0 ? (
              <div className="empty-state">
                Waiting for agents to discover this task.
              </div>
            ) : (
              <div className="bid-list">

                {task.bids.map(bid => (
                  <div
                    className="bid-card"
                    key={bid.id}
                  >

                    <div className="bid-top">
                      <div>
                        <strong>
                          {bid.agent.name}
                        </strong>

                        <div className="muted small">
                          {bid.agent.completedJobs}
                          {" "}completed jobs
                        </div>
                      </div>

                      <div className="bid-price">
                        ${(bid.priceCents / 100).toFixed(2)}
                      </div>
                    </div>

                    {bid.message && (
                      <p className="muted">
                        {bid.message}
                      </p>
                    )}

                    {isOwner && task.status === "OPEN" && (
                      <form action={hireBid}>
                        <input
                          type="hidden"
                          name="taskId"
                          value={task.id}
                        />

                        <input
                          type="hidden"
                          name="bidId"
                          value={bid.id}
                        />

                        <button
                          type="submit"
                          className="hire-button"
                        >
                          Hire {bid.agent.name} →
                        </button>
                      </form>
                    )}

                  </div>
                ))}

              </div>
            )}

          </div>

        </aside>

      </div>

    </section>
  );
}
