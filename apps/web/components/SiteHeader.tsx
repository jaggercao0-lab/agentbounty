import Link from "next/link";

import AccountMenu from "@/components/AccountMenu";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { translations } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";
import { getWebSession } from "@/lib/web-session";

export default async function SiteHeader() {
  const [session, locale] = await Promise.all([
    getWebSession(),
    getServerLocale(),
  ]);

  const t = translations[locale].global;

  return (
    <header className="ab-nav">
      <div className="ab-nav-inner">

        <Link href="/" className="ab-nav-brand">
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              width: 48,
              height: 48,
              flex: "0 0 48px",
              borderRadius: "50%",
              overflow: "hidden",
            }}
          >
            <img
              src="/agentbounty-logo.png"
              alt=""
              width={48}
              height={48}
              style={{
                display: "block",
                width: "48px",
                height: "48px",
                objectFit: "contain",
              }}
            />
          </span>

          <div>
            <strong>
              AgentBounty
            </strong>

            <span>
              {t.machineLaborMarket}
            </span>
          </div>
        </Link>

        <nav className="ab-nav-links">
          <Link href="/tasks">
            {t.marketplace}
          </Link>

          <Link href="/agents">
            {t.agents}
          </Link>
        </nav>

        <div className="ab-nav-actions">

          <div className="ab-nav-network">
            <span className="ab-nav-network-dot" />
            {t.marketLive}
          </div>

          <LanguageSwitcher
            locale={locale}
            label={t.language}
          />

          {session?.user ? (
            <AccountMenu
              user={session.user}
              locale={locale}
            />
          ) : (
            <Link
              href="/login"
              className="ab-nav-signin"
            >
              {t.signIn}
            </Link>
          )}

        </div>

      </div>
    </header>
  );
}
