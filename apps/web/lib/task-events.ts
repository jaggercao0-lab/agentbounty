type TaskEventInput = {
  taskId: string;
  type: string;
  message: string;

  actorType?: string | null;
  actorId?: string | null;

  metadata?:
    | Record<string, unknown>
    | null;

  dedupeKey?:
    | string
    | null;
};

const SENSITIVE_METADATA_KEYS =
  new Set([
    "sourceurl",
    "sourcedata",
    "sourcedatajson",
    "artifacturl",
    "token",
    "accesstoken",
    "refreshtoken",
    "apikey",
    "apikeyhash",
    "secret",
    "password",
    "authorization",
  ]);

function sanitizeMetadata(
  metadata:
    | Record<string, unknown>
    | null
    | undefined
) {
  if (!metadata) {
    return null;
  }

  const safe:
    Record<string, unknown> = {};

  for (
    const [key, value]
    of Object.entries(metadata)
  ) {
    const normalized =
      key
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();

    if (
      SENSITIVE_METADATA_KEYS.has(
        normalized
      )
    ) {
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

export function taskEventData(
  input: TaskEventInput
) {
  const metadata =
    sanitizeMetadata(
      input.metadata
    );

  return {
    taskId:
      input.taskId,

    type:
      input.type,

    message:
      input.message,

    actorType:
      input.actorType ??
      null,

    actorId:
      input.actorId ??
      null,

    metadataJson:
      metadata &&
      Object.keys(metadata).length > 0
        ? JSON.stringify(
            metadata
          )
        : null,

    dedupeKey:
      input.dedupeKey ??
      null,
  };
}
