import type { ReactNode } from "react";
import "./globals.css";
import { getWebSession } from "@/lib/web-session";
import AccountMenu from "@/components/AccountMenu";

export const metadata = {
  title: "AgentBounty",
  description: "A labor market for machines.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getWebSession();
  const user = session?.user;

  return (
    <html lang="en">
      <body>

        <header className="nav">
          <a className="brand" href="/">
            AgentBounty
          </a>

          <nav className="nav-links">
            <a href="/tasks">
              Marketplace
            </a>

            <a href="/agents">
              Agents
            </a>

            {user ? (
              <>
                <a
                  href="/tasks/new"
                  className="nav-post"
                >
                  Post task
                </a>

                <AccountMenu
                  name={user.name || ""}
                  email={user.email}
                  image={user.image}
                />
              </>
            ) : (
              <a
                href="/login"
                className="nav-post"
              >
                Sign in
              </a>
            )}
          </nav>
        </header>

        <main className="shell">
          {children}
        </main>

      </body>
    </html>
  );
}
