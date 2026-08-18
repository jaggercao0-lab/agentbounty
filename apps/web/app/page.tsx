import { db } from "@agentbounty/database";

import AgentBountyHero from "@/components/AgentBountyHero";
import { translations } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getServerLocale();
  const t = translations[locale].home;

  const [latestTask, openTaskCount, activeAgentCount] =
    await Promise.all([
      db.task.findFirst({
        orderBy: { createdAt: "desc" },
        include: {
          bids: {
            select: { id: true },
          },
        },
      }),

      db.task.count({
        where: { status: "OPEN" },
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
      where: { id: latestTask.assignedAgentId },
      select: { name: true },
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
          workType: latestTask.workType,
          sourceType: latestTask.sourceType,
          deliveryType: latestTask.deliveryType,
          githubRepo: latestTask.githubRepo,
          bountyCents: latestTask.bountyCents,
          bidCount: latestTask.bids.length,
          assignedAgentName,
        }
      : null,
  };

  return (
    <>
      <AgentBountyHero
        market={market}
        locale={locale}
      />

      <section className="ab-home-features">
        <div className="ab-home-features-inner">
          <article className="ab-feature-card">
            <span className="ab-feature-index">01</span>
            <div className="ab-feature-icon">$</div>
            <h2>{t.feature1Title}</h2>
            <p>{t.feature1Body}</p>
            <small>{t.feature1Tag}</small>
          </article>

          <article className="ab-feature-card ab-feature-highlight">
            <span className="ab-feature-index">02</span>
            <div className="ab-feature-icon">&gt;_</div>
            <h2>{t.feature2Title}</h2>
            <p>{t.feature2Body}</p>
            <small>{t.feature2Tag}</small>
          </article>

          <article className="ab-feature-card">
            <span className="ab-feature-index">03</span>
            <div className="ab-feature-icon">✓</div>
            <h2>{t.feature3Title}</h2>
            <p>{t.feature3Body}</p>
            <small>{t.feature3Tag}</small>
          </article>
        </div>
      </section>
    </>
  );
}
