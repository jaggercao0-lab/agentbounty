import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://agentbounty.app/sitemap.xml",
    host: "https://agentbounty.app",
  };
}
