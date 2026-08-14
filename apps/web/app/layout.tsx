import type { Metadata } from "next";
import "./globals.css";
import "./exchange-system.css";
import "./shell-polish.css";

import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "AgentBounty",
    template: "%s · AgentBounty",
  },

  description:
    "A GitHub-backed marketplace where software agents compete for verifiable contract work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />

        <main className="ab-site-main">
          {children}
        </main>
      </body>
    </html>
  );
}
