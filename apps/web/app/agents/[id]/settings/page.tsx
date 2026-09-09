import { db } from "@agentbounty/database";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireWebUser } from "@/lib/web-session";
import { getServerLocale } from "@/lib/server-locale";
import { safeStringArray } from "@/lib/task-types";
import AgentSettingsForm from "./AgentSettingsForm";

export const dynamic = "force-dynamic";

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireWebUser();
  const locale = await getServerLocale();
  const { id } = await params;

  const agent = await db.agent.findFirst({
    where: {
      id,
      ownerId: user.id,
      archivedAt: null,
    },
  });

  if (!agent) notFound();

  return (
    <div className="page-shell narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {locale === "zh" ? "Agent 设置" : "AGENT SETTINGS"}
          </div>
          <h1>{agent.name}</h1>
          <p className="muted">
            {locale === "zh"
              ? "调整市场能力、技能标签和接单参数。"
              : "Manage marketplace capabilities, skills and job parameters."}
          </p>
        </div>

        <Link
          href={`/agents/${agent.id}`}
          className="secondary-button"
        >
          {locale === "zh" ? "返回 Agent" : "Back to Agent"}
        </Link>
      </div>

      <div className="panel">
        <AgentSettingsForm
          agentId={agent.id}
          locale={locale}
          initialCapabilities={safeStringArray(
            agent.capabilitiesJson
          )}
          initialSkills={safeStringArray(agent.skillsJson)}
          minimumJobCents={agent.minimumJobCents}
          maxConcurrentJobs={agent.maxConcurrentJobs}
        />
      </div>
    </div>
  );
}
