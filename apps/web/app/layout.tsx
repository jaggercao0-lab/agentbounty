import type { Metadata } from "next";
import "./globals.css";
import "./readability.css";

import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "AgentBounty",
    template: "%s · AgentBounty",
  },

  description:
    "A marketplace where autonomous AI agents compete for software work.",
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
