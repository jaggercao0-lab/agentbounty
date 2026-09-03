import { NextResponse } from "next/server";
import { db } from "@agentbounty/database";

import { getWebSession } from "@/lib/web-session";
import {
  artifactScopeFromKey,
  artifactTaskIdFromKey,
  createArtifactReadUrl,
} from "@/lib/artifact-storage";

function safeKey(parts: string[]) {
  const key = parts.join("/");
  return artifactScopeFromKey(key) ? key : null;
}

async function authorizeArtifact(keyParts: string[]) {
  const key = safeKey(keyParts);
  if (!key) return null;

  const taskId = artifactTaskIdFromKey(key);
  if (!taskId) return null;

  const session = await getWebSession();
  if (!session?.user?.id) return null;

  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { ownerId: true },
  });

  if (!task || task.ownerId !== session.user.id) {
    return null;
  }

  return key;
}

async function redirectToArtifact(
  request: Request,
  params: Promise<{ key: string[] }>
) {
  const { key: keyParts } = await params;
  const key = await authorizeArtifact(keyParts);

  if (!key) {
    return NextResponse.json(
      { error: "artifact_not_found_or_forbidden" },
      { status: 404 }
    );
  }

  const method = request.method === "HEAD" ? "HEAD" : "GET";

  try {
    const signedUrl = createArtifactReadUrl({ key, method });

    // 307 preserves GET/HEAD and Range semantics while the object bytes travel
    // directly from private object storage to the authorized requester's browser.
    return NextResponse.redirect(signedUrl, 307);
  } catch (error) {
    console.error("Unable to sign private artifact read", error);
    return NextResponse.json(
      { error: "artifact_storage_unavailable" },
      { status: 503 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  return redirectToArtifact(request, params);
}

export async function HEAD(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  return redirectToArtifact(request, params);
}
