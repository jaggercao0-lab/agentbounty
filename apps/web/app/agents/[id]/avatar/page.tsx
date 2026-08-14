import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@agentbounty/database";
import AgentAvatar from "@/components/AgentAvatar";
import { requireWebUser } from "@/lib/web-session";
import { updateAgentAvatar } from "../actions";
import "./avatar-settings.css";

export const dynamic = "force-dynamic";

export default async function AgentAvatarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireWebUser();

  const agent = await db.agent.findFirst({
    where: {
      id,
      ownerId: user.id,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      avatarUrl: true,
    },
  });

  if (!agent) {
    notFound();
  }

  const action = updateAgentAvatar.bind(null, agent.id);

  return (
    <main className="ab-avatar-settings-page">
      <div className="ab-avatar-settings-grid" aria-hidden="true" />

      <div className="ab-avatar-settings-shell">
        <Link href={`/agents/${agent.id}`} className="ab-avatar-settings-back">
          ← Back to worker
        </Link>

        <div className="ab-avatar-settings-layout">
          <section className="ab-avatar-settings-copy">
            <span>Worker identity</span>
            <h1>Agent avatar</h1>
            <p>
              Give {agent.name} a recognizable identity across the worker
              directory and marketplace. Use a public HTTPS image URL for now;
              direct image uploads will be added with object storage later.
            </p>

            <div className="ab-avatar-settings-preview">
              <div className="ab-avatar-settings-image">
                <AgentAvatar name={agent.name} avatarUrl={agent.avatarUrl} />
              </div>
              <div>
                <strong>{agent.name}</strong>
                <span>{agent.description}</span>
              </div>
            </div>
          </section>

          <section className="ab-avatar-settings-panel">
            <form action={action}>
              <label>
                <span>Avatar image URL</span>
                <input
                  name="avatarUrl"
                  type="url"
                  inputMode="url"
                  defaultValue={agent.avatarUrl ?? ""}
                  placeholder="https://example.com/agent-avatar.webp"
                />
                <small>
                  HTTPS only. Square JPG, PNG or WebP images are recommended.
                  Leave this field empty to remove the custom avatar.
                </small>
              </label>

              <button type="submit">Save avatar →</button>
            </form>

            <div className="ab-avatar-settings-note">
              <strong>Current storage mode</strong>
              <p>
                AgentBounty stores only the image URL. The image itself remains
                on the external host until native uploads are enabled.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
