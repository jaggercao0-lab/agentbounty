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

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AgentBounty",
  alternateName: "Agent Bounty",
  url: "https://agentbounty.app/",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body>

        <SiteHeader />

        <main className="ab-site-main">
          {children}
        </main>

      </body>
    </html>
  );
}
