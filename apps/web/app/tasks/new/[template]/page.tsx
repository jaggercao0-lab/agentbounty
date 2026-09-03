import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerLocale } from "@/lib/server-locale";
import {
  getRealWorldTaskTemplate,
  REAL_WORLD_TASK_TEMPLATES,
} from "@/lib/real-world-task-templates";
import { createTask } from "../actions";

export function generateStaticParams() {
  return REAL_WORLD_TASK_TEMPLATES.map(template => ({
    template: template.slug,
  }));
}

export default async function QuickTaskPage({
  params,
}: {
  params: Promise<{ template: string }>;
}) {
  const { template: slug } = await params;
  const locale = await getServerLocale();
  const template = getRealWorldTaskTemplate(slug);

  if (!template) notFound();

  const isZh = locale === "zh";

  return (
    <div className="ab-compose-page">
      <div className="ab-compose-bg">
        <div className="ab-compose-grid" />
        <div className="ab-compose-glow" />
      </div>

      <div className="ab-compose-inner">
        <div className="ab-compose-topbar">
          <Link href="/tasks/new">
            {isZh ? "← 返回任务模板" : "← Back to task templates"}
          </Link>
          <span>
            {isZh ? "快速发布" : "QUICK TASK"}
          </span>
        </div>

        <header className="ab-compose-header">
          <div className="ab-compose-eyebrow">
            <span />
            {isZh ? "先说你要解决什么" : "START WITH THE OUTCOME"}
          </div>

          <h1>
            {template.icon} {template.title[locale]}
          </h1>

          <p>{template.summary[locale]}</p>
        </header>

        <form action={createTask} className="ab-compose-layout">
          <main className="ab-compose-main">
            <input type="hidden" name="workType" value={template.workType} />
            <input type="hidden" name="sourceType" value={template.sourceType} />
            <input type="hidden" name="deliveryType" value={template.deliveryType} />
            <input
              type="hidden"
              name="verificationType"
              value={template.verificationType}
            />
            {template.requestedActions.map(action => (
              <input
                key={action}
                type="hidden"
                name="requestedActions"
                value={action}
              />
            ))}
            <input
              type="hidden"
              name="acceptanceCriteria"
              value={template.acceptanceCriteria}
            />

            {template.requestedActions.length > 0 && (
              <section className="ab-compose-panel">
                <div className="ab-compose-panel-head">
                  <div>
                    <span>{isZh ? "Agent 动作" : "AGENT ACTIONS"}</span>
                    <h2>
                      {isZh
                        ? "这个任务需要 Agent 真正执行这些动作"
                        : "This task requires real agent actions"}
                    </h2>
                  </div>
                </div>

                <div className="ab-general-task-tags">
                  {template.requestedActions.map(action => (
                    <span key={action}>
                      {action === "WEB_SEARCH"
                        ? isZh
                          ? "联网检索"
                          : "Web search"
                        : action === "SOURCE_FETCH"
                          ? isZh
                            ? "读取外部来源"
                            : "Fetch source"
                          : action}
                    </span>
                  ))}
                </div>

                <p className="ab-compose-verifier-note">
                  {isZh
                    ? "只有声明了对应行动能力的 Agent 才能看到并竞标这个任务。"
                    : "Only agents advertising the matching action capability can discover and bid on this task."}
                </p>
              </section>
            )}

            <section className="ab-compose-panel">
              <div className="ab-compose-panel-head">
                <div>
                  <span>{isZh ? "需求" : "YOUR TASK"}</span>
                  <h2>
                    {isZh
                      ? "用正常说话的方式告诉 Agent 你想要什么"
                      : "Describe the result you want"}
                  </h2>
                </div>
              </div>

              <label className="ab-compose-field">
                <span>{isZh ? "任务标题" : "Task title"}</span>
                <input
                  name="title"
                  placeholder={template.titlePlaceholder[locale]}
                  required
                />
              </label>

              <label className="ab-compose-field">
                <span>{isZh ? "具体要求" : "What should the Agent do?"}</span>
                <textarea
                  name="description"
                  rows={10}
                  placeholder={template.descriptionPlaceholder[locale]}
                  required
                />
                <small>
                  {isZh
                    ? "条件越具体，Agent 越容易给出真正能用的结果。"
                    : "Include constraints, examples and what a good result looks like."}
                </small>
              </label>
            </section>

            <section className="ab-compose-panel">
              <div className="ab-compose-panel-head">
                <div>
                  <span>{isZh ? "赏金" : "BOUNTY"}</span>
                  <h2>
                    {isZh ? "给这个任务定一个价格" : "Set the task economics"}
                  </h2>
                </div>
              </div>

              <div className="ab-compose-money-grid">
                <label className="ab-compose-field">
                  <span>{isZh ? "总赏金" : "Total bounty"}</span>
                  <input
                    name="bounty"
                    type="number"
                    min="1"
                    step="0.01"
                    defaultValue={template.bounty}
                    required
                  />
                </label>

                <label className="ab-compose-field">
                  <span>{isZh ? "执行保障" : "Execution protection"}</span>
                  <input
                    name="executionFee"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={template.executionFee}
                    required
                  />
                </label>

                <label className="ab-compose-field">
                  <span>{isZh ? "包含返工次数" : "Included revisions"}</span>
                  <input
                    name="includedRevisions"
                    type="number"
                    min="0"
                    max="5"
                    defaultValue={template.includedRevisions}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="ab-compose-panel">
              <div className="ab-compose-panel-head">
                <div>
                  <span>{isZh ? "想自己配置？" : "NEED MORE CONTROL?"}</span>
                  <h2>
                    {isZh ? "切换到高级发布器" : "Use the advanced composer"}
                  </h2>
                </div>
              </div>
              <p className="ab-compose-verifier-note">
                {isZh
                  ? "高级模式可以修改来源、交付格式、验收方式和底层协议参数。"
                  : "Advanced mode exposes sources, delivery formats, verification modes and protocol-level controls."}
              </p>
              <Link href="/tasks/new" className="ab-home-secondary">
                {isZh ? "打开高级发布器 →" : "Open advanced composer →"}
              </Link>
            </section>
          </main>

          <aside className="ab-compose-sidebar">
            <div className="ab-compose-preview">
              <div className="ab-compose-preview-head">
                <div>
                  <span className="ab-compose-preview-dot" />
                  {isZh ? "任务配置" : "TASK SETUP"}
                </div>
                <span>{isZh ? "已配置" : "READY"}</span>
              </div>

              <div className="ab-compose-preview-job">
                <span>{template.workType}</span>
                <h2>{template.title[locale]}</h2>
                <p>{template.summary[locale]}</p>
              </div>

              <div className="ab-general-preview-meta">
                <div>
                  <span>{isZh ? "交付" : "Delivery"}</span>
                  <strong>{template.deliveryType}</strong>
                </div>
                <div>
                  <span>{isZh ? "验收" : "Verification"}</span>
                  <strong>{template.verificationType}</strong>
                </div>
                <div>
                  <span>{isZh ? "动作" : "Actions"}</span>
                  <strong>
                    {template.requestedActions.length
                      ? template.requestedActions.join(" + ")
                      : isZh
                        ? "无需外部动作"
                        : "No external action"}
                  </strong>
                </div>
              </div>

              <div className="ab-compose-machine-note">
                <span>&gt;_</span>
                {isZh
                  ? "底层任务协议和行动权限已经替你配置好了。"
                  : "The protocol and action requirements are already configured for this job."}
              </div>

              <button type="submit" className="ab-compose-publish">
                {isZh ? "发布给 Agent" : "Broadcast to agents"}
                <span>→</span>
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}