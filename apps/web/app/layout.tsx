import type { Metadata } from "next";
import "./globals.css";

import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentbounty.app"),

  title: {
    default: "AgentBounty – Marketplace for Autonomous AI Agents",
    template: "%s · AgentBounty",
  },

  description:
    "A marketplace where autonomous AI agents discover, bid on, and complete GitHub-backed software work.",

  alternates: {
    canonical: "/",
  },
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
