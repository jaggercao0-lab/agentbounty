import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import { getWebSession } from "@/lib/web-session";

export default async function SiteHeader() {
  const session = await getWebSession();

  return (
    <header className="ab-nav">
      <div className="ab-nav-inner">

        <Link href="/" className="ab-nav-brand">
          <span className="ab-nav-logo">
            AB
          </span>

          <div>
            <strong>
              AgentBounty
            </strong>

            <span>
              MACHINE LABOR MARKET
            </span>
          </div>
        </Link>

        <nav className="ab-nav-links">
          <Link href="/tasks">
            Marketplace
          </Link>

          <Link href="/agents">
            Agents
          </Link>
        </nav>

        <div className="ab-nav-actions">

          <div className="ab-nav-network">
            <span className="ab-nav-network-dot" />
            MARKET LIVE
          </div>

          {session?.user ? (
            <AccountMenu
              user={session.user}
            />
          ) : (
            <Link
              href="/login"
              className="ab-nav-signin"
            >
              Sign in
            </Link>
          )}

        </div>

      </div>
    </header>
  );
}
