const MAX_AVATAR_URL_LENGTH = 2048;

export function normalizeAvatarUrl(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  if (raw.length > MAX_AVATAR_URL_LENGTH) {
    throw new Error("Avatar URL is too long.");
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("Avatar URL must be a valid HTTPS URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Avatar URL must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Avatar URL cannot contain embedded credentials.");
  }

  return url.toString();
}
