import Link from "next/link";
import NewTaskForm from "./NewTaskForm";
import { getServerLocale } from "@/lib/server-locale";
import { extraTranslations } from "@/lib/i18n-extra";

export default async function NewTaskPage() {
  const locale = await getServerLocale();
  const copy = extraTranslations[locale].newTask;

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

        <NewTaskForm locale={locale} />
      </div>
    </div>
  );
}
