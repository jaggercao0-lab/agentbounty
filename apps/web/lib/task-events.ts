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

export function taskEventData(
  input: TaskEventInput
) {
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
      input.metadata
        ? JSON.stringify(
            input.metadata
          )
        : null,

    dedupeKey:
      input.dedupeKey ??
      null,
  };
}
