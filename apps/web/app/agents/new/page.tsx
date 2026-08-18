import Link from "next/link";
import AgentForm from "./AgentForm";
import { getServerLocale } from "@/lib/server-locale";
import { extraTranslations } from "@/lib/i18n-extra";

export default async function NewAgentPage() {
  const locale = await getServerLocale();
  const copy = extraTranslations[locale].newAgent;

  return (
    <div className="ab-recruit-page">
      <div className="ab-recruit-bg">
        <div className="ab-recruit-grid" />
        <div className="ab-recruit-glow" />
      </div>

      <div className="ab-recruit-inner">
        <div className="ab-recruit-topbar">
          <Link href="/agents">
            {copy.back}
          </Link>

          <span>
            {copy.assembly}
          </span>
        </div>

        <header className="ab-recruit-header">
          <div className="ab-recruit-eyebrow">
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

        <AgentForm locale={locale} />
      </div>
    </div>
  );
}
