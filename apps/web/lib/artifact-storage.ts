import {
  createHash,
  createHmac,
  randomUUID,
} from "node:crypto";

const MAX_ARTIFACT_BYTES = 250 * 1024 * 1024;
const PRESIGN_TTL_SECONDS = 15 * 60;

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
  publicBaseUrl: string;
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

function getConfig(): ArtifactStorageConfig | null {
  const endpointRaw = process.env.ARTIFACT_S3_ENDPOINT?.trim();
  const bucket = process.env.ARTIFACT_S3_BUCKET?.trim();
  const accessKeyId = process.env.ARTIFACT_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.ARTIFACT_S3_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.ARTIFACT_PUBLIC_BASE_URL?.trim();

  if (
    !endpointRaw ||
    !bucket ||
    !accessKeyId ||
    !secretAccessKey ||
    !publicBaseUrl
  ) {
    return null;
  }

  let endpoint: URL;
  let publicUrl: URL;

  try {
    endpoint = new URL(endpointRaw);
    publicUrl = new URL(publicBaseUrl);
  } catch {
    return null;
  }

  if (endpoint.protocol !== "https:" || publicUrl.protocol !== "https:") {
    return null;
  }

  return {
    endpoint,
    region: process.env.ARTIFACT_S3_REGION?.trim() || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: publicBaseUrl.toString().replace(/\/$/, ""),
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
  const extension = MIME_EXTENSIONS[contentType.toLowerCase()];

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

  return { extension };
}

function amzTimestamp(now: Date) {
  return now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");
}

export function createArtifactUpload({
  taskId,
  agentId,
  contentType,
  contentLength,
  now = new Date(),
}: {
  taskId: string;
  agentId: string;
  contentType: string;
  contentLength: number;
  now?: Date;
}) {
  const config = getConfig();
  if (!config) {
    throw new Error("artifact_storage_not_configured");
  }

  const { extension } = validateArtifactRequest({
    contentType,
    contentLength,
  });

  const date = amzTimestamp(now).slice(0, 8);
  const amzDate = amzTimestamp(now);
  const key = [
    "tasks",
    taskId,
    agentId,
    date,
    `${randomUUID()}.${extension}`,
  ].join("/");

  const endpointBasePath = config.endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = `${endpointBasePath}/${awsEncode(config.bucket)}/${encodePath(key)}`
    .replace(/\/+/g, "/");
  const credentialScope = `${date}/${config.region}/s3/aws4_request`;

  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(PRESIGN_TTL_SECONDS)],
    ["X-Amz-SignedHeaders", "host"],
  ];

  const canonicalQuery = queryEntries
    .map(([name, value]) => [awsEncode(name), awsEncode(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const host = config.endpoint.host;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    "host",
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

  const uploadUrl = new URL(config.endpoint.toString());
  uploadUrl.pathname = canonicalUri;
  uploadUrl.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;

  return {
    uploadUrl: uploadUrl.toString(),
    artifactUrl: `${config.publicBaseUrl}/${encodePath(key)}`,
    storageKey: key,
    expiresInSeconds: PRESIGN_TTL_SECONDS,
    headers: {
      "Content-Type": contentType,
    },
  };
}
