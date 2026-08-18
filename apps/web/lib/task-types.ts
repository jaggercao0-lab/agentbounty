export const WORK_TYPES = [
  "CODE",
  "RESEARCH",
  "IMAGE",
  "VIDEO",
  "DATA",
  "AUTOMATION",
  "OTHER",
] as const;

export const SOURCE_TYPES = [
  "MANUAL",
  "GITHUB_ISSUE",
  "URL",
  "FILE",
  "API",
] as const;

export const DELIVERY_TYPES = [
  "PULL_REQUEST",
  "TEXT",
  "FILE",
  "URL",
  "JSON",
] as const;

export const VERIFICATION_TYPES = [
  "GITHUB",
  "AUTOMATIC",
  "MANUAL",
  "HYBRID",
] as const;

export type WorkType = typeof WORK_TYPES[number];
export type SourceType = typeof SOURCE_TYPES[number];
export type DeliveryType = typeof DELIVERY_TYPES[number];
export type VerificationType = typeof VERIFICATION_TYPES[number];

export const DEFAULT_DELIVERY_BY_WORK: Record<WorkType, DeliveryType> = {
  CODE: "PULL_REQUEST",
  RESEARCH: "TEXT",
  IMAGE: "FILE",
  VIDEO: "FILE",
  DATA: "JSON",
  AUTOMATION: "JSON",
  OTHER: "URL",
};

export const DEFAULT_VERIFICATION_BY_WORK: Record<WorkType, VerificationType> = {
  CODE: "GITHUB",
  RESEARCH: "MANUAL",
  IMAGE: "MANUAL",
  VIDEO: "MANUAL",
  DATA: "HYBRID",
  AUTOMATION: "HYBRID",
  OTHER: "MANUAL",
};

export const CAPABILITY_FOR_WORK: Record<WorkType, string> = {
  CODE: "CODE",
  RESEARCH: "RESEARCH",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  DATA: "DATA",
  AUTOMATION: "AUTOMATION",
  OTHER: "OTHER",
};

export function safeStringArray(value: string | null | undefined) {
  if (!value) return [] as string[];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function requiredCapabilitiesFor(workType: WorkType) {
  return [CAPABILITY_FOR_WORK[workType]];
}

export function hasRequiredCapabilities(
  capabilitiesJson: string | null | undefined,
  requiredCapabilitiesJson: string | null | undefined
) {
  const capabilities = new Set(
    safeStringArray(capabilitiesJson).map(value => value.toUpperCase())
  );

  const required = safeStringArray(requiredCapabilitiesJson)
    .map(value => value.toUpperCase());

  return required.every(value => capabilities.has(value));
}

function isPrivateIpv4(hostname: string) {
  const match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );

  if (!match) return false;

  const parts = match.slice(1).map(Number);
  if (parts.some(value => value < 0 || value > 255)) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function isSafeExternalSourceUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname
      .replace(/^\[|\]$/g, "")
      .toLowerCase();

    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "::1" ||
      hostname === "0:0:0:0:0:0:0:1" ||
      isPrivateIpv4(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
