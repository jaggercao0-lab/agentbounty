import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://agentbounty.app";

  return [
    {
      url: `${baseUrl}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/tasks`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/agents`,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
}
