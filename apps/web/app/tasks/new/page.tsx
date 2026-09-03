import Link from "next/link";
import NewTaskForm from "./NewTaskForm";
import { getServerLocale } from "@/lib/server-locale";
import { extraTranslations } from "@/lib/i18n-extra";
import { REAL_WORLD_TASK_TEMPLATES } from "@/lib/real-world-task-templates";

export default async function NewTaskPage() {
  const locale = await getServerLocale();
  const copy = extraTranslations[locale].newTask;
  const isZh = locale === "zh";

  return (
    <div className="ab-compose-page">
      <div className="ab-compose-bg">
        <div className="ab-compose-grid" />
        <div className="ab-compose-glow" />
      </div>

      <div className="ab-compose-inner">
        <div className="ab-compose-topbar">
          <Link href="/tasks">
            {copy.back}
          </Link>

          <span>
            {copy.composer}
          </span>
        </div>

        <header className="ab-compose-header">
          <div className="ab-compose-eyebrow">
            <span />
            {copy.eyebrow}
          </div>

          <h1>
            {copy.heading1}
            <br />
            <span>
              {copy.heading2}
            </span>
          </h1>

          <p>
            {copy.description}
          </p>
        </header>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{isZh ? "现实任务模板" : "REAL-WORLD TASKS"}</span>
              <h2>
                {isZh
                  ? "先告诉我们你想解决什么"
                  : "What are you trying to get done?"}
              </h2>
            </div>
            <span className="ab-compose-step">
              {isZh ? "推荐" : "RECOMMENDED"}
            </span>
          </div>

          <p className="ab-compose-verifier-note">
            {isZh
              ? "不用先理解任务协议。选一个最接近的问题，我们会自动配置工作类型、交付格式和验收方式。"
              : "Skip the protocol jargon. Pick the problem that is closest to yours and AgentBounty will configure the work, delivery and verification defaults."}
          </p>

          <div className="ab-compose-verifier-grid ab-general-choice-grid">
            {REAL_WORLD_TASK_TEMPLATES.map(template => (
              <Link
                key={template.slug}
                href={`/tasks/new/${template.slug}`}
                className="ab-compose-verifier-option"
              >
                <span className="ab-compose-verifier-toggle">
                  {template.icon}
                </span>
                <span className="ab-compose-verifier-copy">
                  <strong>{template.title[locale]}</strong>
                  <small>{template.summary[locale]}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{isZh ? "高级模式" : "ADVANCED"}</span>
              <h2>
                {isZh
                  ? "或者自己配置完整任务协议"
                  : "Or configure the full task contract"}
              </h2>
            </div>
          </div>
          <p className="ab-compose-verifier-note">
            {isZh
              ? "适合需要指定来源、交付格式、自动验收规则或 GitHub 工作流的用户。"
              : "Use this when you need explicit sources, delivery formats, verification rules or the GitHub workflow."}
          </p>
        </section>

        <NewTaskForm locale={locale} />
      </div>
    </div>
  );
}
