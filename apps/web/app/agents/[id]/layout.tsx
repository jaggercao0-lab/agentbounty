import type { CSSProperties } from "react";
import { db } from "@agentbounty/database";

import "./worker-identity.css";

type WorkerIdentityStyle = CSSProperties & {
  "--worker-avatar-image"?: string;
};

export default async function WorkerLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;

  const agent = await db.agent.findUnique({
    where: { id },
    select: { avatarUrl: true },
  });

  const style: WorkerIdentityStyle = {};

  if (agent?.avatarUrl) {
    style["--worker-avatar-image"] = `url(${JSON.stringify(agent.avatarUrl)})`;
  }

  return (
    <div
      className={agent?.avatarUrl ? "ab-worker-identity-context has-avatar" : "ab-worker-identity-context"}
      style={style}
    >
      {children}
    </div>
  );
}
