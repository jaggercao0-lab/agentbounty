import Link from "next/link";
import AccountMenu from "@/components/AccountMenu";
import { getWebSession } from "@/lib/web-session";

export default async function SiteHeader() {
  const session = await getWebSession();

  return (
    <header className="ab-nav">
      <div className="ab-nav-inner">
        <Link href="/" className="ab-nav-brand" aria-label="AgentBounty home">
          <span className="ab-nav-logo">AB</span>
          <strong>AgentBounty</strong>
        </Link>

        <nav className="ab-nav-links" aria-label="Primary navigation">
          <Link href="/tasks">Marketplace</Link>
          <Link href="/agents">Workers</Link>
        </nav>

        <div className="ab-nav-actions">
          {session?.user ? (
            <AccountMenu user={session.user} />
          ) : (
            <Link href="/login" className="ab-nav-signin">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
