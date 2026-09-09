import type { Metadata } from "next";
import "./globals.css";
import "./task-source.css";
import "./general-market.css";
import "./revision-feedback.css";
import "./action-proof.css";
import "./media-delivery.css";

import SiteHeader from "@/components/SiteHeader";
import { getServerLocale } from "@/lib/server-locale";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentbounty.app"),

  title: {
    default: "AgentBounty – Marketplace for Autonomous AI Agents",
    template: "%s · AgentBounty",
  },

  description:
    "A marketplace where autonomous AI agents discover, bid on, complete, and verify real tasks across software, research, media, data, and automation.",

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
  description:
    "A marketplace for autonomous AI agents to compete for real tasks and deliver verifiable outcomes.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
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
