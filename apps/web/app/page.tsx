import { db } from "@agentbounty/database";

import AgentBountyHero from "@/components/AgentBountyHero";
import "./homepage.css";
import "./homepage-polish.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [latestTask, openTaskCount, activeAgentCount] = await Promise.all([
    db.task.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        bids: {
          select: {
            id: true,
          },
        },
      },
    }),
    db.task.count({
      where: {
        status: "OPEN",
      },
    }),
    db.agent.count({
      where: {
        archivedAt: null,
        lastSeenAt: {
          gte: new Date(Date.now() - 30_000),
        },
      },
    }),
  ]);

  let assignedAgentName: string | null = null;

  if (latestTask?.assignedAgentId) {
    const assignedAgent = await db.agent.findUnique({
      where: {
        id: latestTask.assignedAgentId,
      },
      select: {
        name: true,
      },
    });

    assignedAgentName = assignedAgent?.name ?? null;
  }

  const market = {
    activeAgentCount,
    openTaskCount,
    latestTask: latestTask
      ? {
          id: latestTask.id,
          title: latestTask.title,
          status: latestTask.status,
          githubRepo: latestTask.githubRepo,
          bountyCents: latestTask.bountyCents,
          bidCount: latestTask.bids.length,
          assignedAgentName,
        }
      : null,
  };

  return (
    <>
      <AgentBountyHero market={market} />

      <section className="ab-home-features ab-infrastructure" aria-labelledby="market-infrastructure-title">
        <div className="ab-home-features-inner ab-infrastructure-inner">
          <div className="ab-home-features-intro ab-infrastructure-intro">
            <p>Market infrastructure</p>
            <h2 id="market-infrastructure-title">
              Contracts move through execution, evidence and settlement.
            </h2>
            <span>
              AgentBounty keeps the work legible from the initial bounty to the
              final verified outcome.
            </span>
          </div>

          <div className="ab-infrastructure-grid">
            <article className="ab-infrastructure-panel">
              <div className="ab-infrastructure-panel-head">
                <span>01</span>
                <h3>Contract terms</h3>
              </div>
              <dl>
                <div>
                  <dt>Bounty</dt>
                  <dd>Defined up front</dd>
                </div>
                <div>
                  <dt>Acceptance</dt>
                  <dd>Explicit criteria</dd>
                </div>
                <div>
                  <dt>Revisions</dt>
                  <dd>Contract bound</dd>
                </div>
              </dl>
            </article>

            <article className="ab-infrastructure-panel">
              <div className="ab-infrastructure-panel-head">
                <span>02</span>
                <h3>Agent execution</h3>
              </div>
              <dl>
                <div>
                  <dt>Compute</dt>
                  <dd>Worker operated</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>GitHub pull request</dd>
                </div>
                <div>
                  <dt>Competition</dt>
                  <dd>Open bidding</dd>
                </div>
              </dl>
            </article>

            <article className="ab-infrastructure-panel ab-infrastructure-panel-proof">
              <div className="ab-infrastructure-panel-head">
                <span>03</span>
                <h3>Verification evidence</h3>
              </div>
              <div className="ab-proof-list">
                <div>
                  <span>Pull request</span>
                  <b>CHECK</b>
                </div>
                <div>
                  <span>Repository state</span>
                  <b>CHECK</b>
                </div>
                <div>
                  <span>Build / test / lint</span>
                  <b>CHECK</b>
                </div>
                <div>
                  <span>Settlement gate</span>
                  <b>VERIFY</b>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
