import {
  createHash,
  createHmac,
  randomUUID,
} from "node:crypto";

export const MAX_ARTIFACT_BYTES = 250 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 15 * 60;
const READ_TTL_SECONDS = 10 * 60;

const MIME_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/json": "json",
  "text/plain": "txt",
};

type ArtifactStorageConfig = {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  appBaseUrl: URL;
};

export type ArtifactScope = {
  taskId: string;
  agentId: string;
  date: string;
  filename: string;
};

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(value: string) {
  return value
    .split("/")
    .map(segment => awsEncode(segment))
    .join("/");
}

function decodePath(value: string) {
  return value
    .split("/")
    .map(segment => decodeURIComponent(segment))
    .join("/");
}

function getConfig(): ArtifactStorageConfig | null {
  const endpointRaw = process.env.ARTIFACT_S3_ENDPOINT?.trim();
  const bucket = process.env.ARTIFACT_S3_BUCKET?.trim();
  const accessKeyId = process.env.ARTIFACT_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.ARTIFACT_S3_SECRET_ACCESS_KEY?.trim();
  const appBaseRaw = process.env.BETTER_AUTH_URL?.trim();

  if (
    !endpointRaw ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey ||
    !appBaseRaw
  ) {
    return null;
  }

  let endpoint: URL;
  let appBaseUrl: URL;

  try {
    endpoint = new URL(endpointRaw);
    appBaseUrl = new URL(appBaseRaw);
  } catch {
    return null;
  }

  if (endpoint.protocol !== "https:") {
    return null;
  }

  if (
    appBaseUrl.protocol !== "https:" &&
    !(appBaseUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(appBaseUrl.hostname))
  ) {
    return null;
  }

  return {
    endpoint,
    region: process.env.ARTIFACT_S3_REGION?.trim() || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    appBaseUrl,
  };
}

export function artifactStorageConfigured() {
  return Boolean(getConfig());
}

export function validateArtifactRequest({
  contentType,
  contentLength,
}: {
  contentType: string;
  contentLength: number;
}) {
  const normalizedContentType = contentType.trim().toLowerCase();
  const extension = MIME_EXTENSIONS[normalizedContentType];

  if (!extension) {
    throw new Error("unsupported_artifact_mime_type");
  }

  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_ARTIFACT_BYTES
  ) {
    throw new Error("invalid_artifact_size");
  }

  return {
    extension,
    contentType: normalizedContentType,
  };
}

function amzTimestamp(now: Date) {
  return now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");
}

function presignObjectRequest({
  method,
  key,
  expiresInSeconds,
  contentType,
  now = new Date(),
}: {
  method: "PUT" | "GET" | "HEAD";
  key: string;
  expiresInSeconds: number;
  contentType?: string;
  now?: Date;
}) {
  const config = getConfig();
  if (!config) {
    throw new Error("artifact_storage_not_configured");
  }

  const date = amzTimestamp(now).slice(0, 8);
  const amzDate = amzTimestamp(now);
  const endpointBasePath = config.endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = `${endpointBasePath}/${awsEncode(config.bucket)}/${encodePath(key)}`
    .replace(/\/+/g, "/");
  const credentialScope = `${date}/${config.region}/s3/aws4_request`;
  const host = config.endpoint.host;

  const normalizedContentType = contentType?.trim().toLowerCase() || null;
  const signedHeaders = normalizedContentType
    ? "content-type;host"
    : "host";
  const canonicalHeaders = normalizedContentType
    ? `content-type:${normalizedContentType}\nhost:${host}\n`
    : `host:${host}\n`;

  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresInSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];

  const canonicalQuery = queryEntries
    .map(([name, value]) => [awsEncode(name), awsEncode(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${config.secretAccessKey}`, date);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  return (
    `${config.endpoint.origin}${canonicalUri}?` +
    `${canonicalQuery}&X-Amz-Signature=${signature}`
  );
}

function managedArtifactUrl(key: string) {
  const config = getConfig();
  if (!config) {
    throw new Error("artifact_storage_not_configured");
  }

  const base = config.appBaseUrl.toString().replace(/\/$/, "");
  return `${base}/api/artifacts/${encodePath(key)}`;
}

export function artifactScopeFromKey(key: string): ArtifactScope | null {
  const segments = key.split("/");

  if (
    segments.length !== 5 ||
    segments[0] !== "tasks" ||
    segments.some(segment => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  const [, taskId, agentId, date, filename] = segments;

  if (!/^\d{8}$/.test(date)) {
    return null;
  }

  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(filename)) {
    return null;
  }

  return {
    taskId,
    agentId,
    date,
    filename,
  };
}

export function managedArtifactKeyFromUrl(
  value: string | null | undefined
) {
  const config = getConfig();
  if (!config || !value) return null;

  try {
    const candidate = new URL(value);
    const base = config.appBaseUrl;
    const prefix = "/api/artifacts/";

    if (
      candidate.origin !== base.origin ||
      !candidate.pathname.startsWith(prefix)
    ) {
      return null;
    }

    const key = decodePath(candidate.pathname.slice(prefix.length));
    return artifactScopeFromKey(key) ? key : null;
  } catch {
    return null;
  }
}

export function isManagedArtifactUrl(value: string | null | undefined) {
  return Boolean(managedArtifactKeyFromUrl(value));
}

export function artifactTaskIdFromKey(key: string) {
  return artifactScopeFromKey(key)?.taskId || null;
}

export function createArtifactReadUrl({
  key,
  method = "GET",
}: {
  key: string;
  method?: "GET" | "HEAD";
}) {
  if (!artifactScopeFromKey(key)) {
    throw new Error("invalid_artifact_key");
  }

  return presignObjectRequest({
    method,
    key,
    expiresInSeconds: READ_TTL_SECONDS,
  });
}

export function createArtifactUpload({
  taskId,
  agentId,
  contentType,
  contentLength,
}: {
  taskId: string;
  agentId: string;
  contentType: string;
  contentLength: number;
}) {
  const validated = validateArtifactRequest({
    contentType,
    contentLength,
  });

  const date = amzTimestamp(new Date()).slice(0, 8);
  const key = [
    "tasks",
    taskId,
    agentId,
    date,
    `${randomUUID()}.${validated.extension}`,
  ].join("/");

  return {
    uploadUrl: presignObjectRequest({
      method: "PUT",
      key,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
      contentType: validated.contentType,
    }),
    artifactUrl: managedArtifactUrl(key),
    storageKey: key,
    expiresInSeconds: UPLOAD_TTL_SECONDS,
    headers: {
      "Content-Type": validated.contentType,
    },
  };
}
