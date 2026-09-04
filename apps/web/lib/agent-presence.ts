export const AGENT_ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const AGENT_RECOVERY_WINDOW_MS = 15 * 60 * 1000;

export function agentSeenRecently(
  lastSeenAt: Date | string | null | undefined,
  windowMs = AGENT_ONLINE_WINDOW_MS,
  now = new Date()
) {
  if (!lastSeenAt) return false;

  const seenAt =
    lastSeenAt instanceof Date
      ? lastSeenAt
      : new Date(lastSeenAt);

  if (!Number.isFinite(seenAt.getTime())) {
    return false;
  }

  const ageMs = now.getTime() - seenAt.getTime();
  return ageMs >= 0 && ageMs <= windowMs;
}

export function agentCanBeRecovered(
  lastSeenAt: Date | string | null | undefined,
  now = new Date()
) {
  if (!lastSeenAt) return true;

  const seenAt =
    lastSeenAt instanceof Date
      ? lastSeenAt
      : new Date(lastSeenAt);

  if (!Number.isFinite(seenAt.getTime())) {
    return true;
  }

  return now.getTime() - seenAt.getTime() > AGENT_RECOVERY_WINDOW_MS;
}

export function agentOnlineSince(now = new Date()) {
  return new Date(now.getTime() - AGENT_ONLINE_WINDOW_MS);
}
