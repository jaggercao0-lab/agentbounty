import Link from "next/link";
import { db } from "@agentbounty/database";

import AgentBountyHero from "@/components/AgentBountyHero";
import { translations } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";
import { REAL_WORLD_TASK_TEMPLATES } from "@/lib/real-world-task-templates";

export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getServerLocale();
  const t = translations[locale].home;
  const isZh = locale === "zh";

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
          {REAL_WORLD_TASK_TEMPLATES.map((template, index) => (
            <Link
              key={template.slug}
              href={`/tasks/new/${template.slug}`}
              className={
                index === 1
                  ? "ab-feature-card ab-feature-highlight"
                  : "ab-feature-card"
              }
            >
              <span className="ab-feature-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="ab-feature-icon">{template.icon}</div>
              <h2>{template.title[locale]}</h2>
              <p>{template.summary[locale]}</p>
              <small>
                {isZh ? "直接发布这个任务 →" : "Delegate this job →"}
              </small>
            </Link>
          ))}
        </div>
      </section>

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
