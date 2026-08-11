import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@agentbounty/database";

export const webAuth = betterAuth({
  appName: "AgentBounty",

  database: prismaAdapter(db, {
    provider: "sqlite",
  }),

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID!,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET!,
    },
  },
});
