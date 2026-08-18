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
  DATA: "FILE",
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
