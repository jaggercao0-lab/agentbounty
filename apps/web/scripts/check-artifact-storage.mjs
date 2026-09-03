import assert from "node:assert/strict";

process.env.ARTIFACT_S3_ENDPOINT =
  "https://exampleaccount.r2.cloudflarestorage.com";
process.env.ARTIFACT_S3_REGION = "auto";
process.env.ARTIFACT_S3_BUCKET = "agentbounty-artifacts";
process.env.ARTIFACT_S3_ACCESS_KEY_ID = "CIACCESSKEY";
process.env.ARTIFACT_S3_SECRET_ACCESS_KEY = "ci-secret-access-key";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

const {
  MAX_ARTIFACT_BYTES,
  artifactScopeFromKey,
  createArtifactUpload,
  managedArtifactKeyFromUrl,
} = await import("../lib/artifact-storage.ts");

const grant = createArtifactUpload({
  taskId: "task-ci",
  agentId: "agent-ci",
  contentType: "VIDEO/MP4",
  contentLength: 12_345,
});

const uploadUrl = new URL(grant.uploadUrl);
assert.equal(uploadUrl.protocol, "https:");
assert.equal(
  uploadUrl.searchParams.get("X-Amz-SignedHeaders"),
  "content-length;content-type;host"
);
assert.equal(grant.headers["Content-Type"], "video/mp4");
assert.equal(
  grant.artifactUrl,
  `http://localhost:3000/api/artifacts/${grant.storageKey}`
);

const parsedKey = managedArtifactKeyFromUrl(grant.artifactUrl);
assert.equal(parsedKey, grant.storageKey);

const scope = artifactScopeFromKey(grant.storageKey);
assert.ok(scope);
assert.equal(scope.taskId, "task-ci");
assert.equal(scope.agentId, "agent-ci");
assert.match(scope.date, /^\d{8}$/);
assert.match(scope.filename, /^[0-9a-f-]{36}\.mp4$/i);

assert.equal(
  managedArtifactKeyFromUrl(
    grant.artifactUrl.replace("localhost:3000", "evil.example")
  ),
  null
);

assert.throws(
  () => createArtifactUpload({
    taskId: "task-ci",
    agentId: "agent-ci",
    contentType: "video/mp4",
    contentLength: MAX_ARTIFACT_BYTES + 1,
  }),
  /invalid_artifact_size/
);

assert.throws(
  () => createArtifactUpload({
    taskId: "task-ci",
    agentId: "agent-ci",
    contentType: "application/x-msdownload",
    contentLength: 100,
  }),
  /unsupported_artifact_mime_type/
);

console.log("Artifact storage self-check passed.");
