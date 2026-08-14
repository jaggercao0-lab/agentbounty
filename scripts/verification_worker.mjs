import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const ROOT =
  path.resolve(__dirname, "..");

const ENV_PATH =
  path.join(
    ROOT,
    "apps/web/.env.local"
  );

const PLATFORM_URL =
  (
    process.env
      .AGENTBOUNTY_PLATFORM_URL
    || "http://localhost:3000"
  )
    .trim()
    .replace(/\/+$/, "");

const INTERVAL_SECONDS =
  Number(
    process.env
      .AGENTBOUNTY_VERIFICATION_INTERVAL_SECONDS
    || "15"
  );

function loadInternalKey() {
  const envValue =
    (
      process.env
        .AGENTBOUNTY_INTERNAL_KEY
      || ""
    ).trim();

  if (envValue) {
    return envValue;
  }

  if (
    fs.existsSync(
      ENV_PATH
    )
  ) {
    const lines =
      fs.readFileSync(
        ENV_PATH,
        "utf8"
      )
      .split(/\r?\n/);

    for (
      const raw
      of lines
    ) {
      const line =
        raw.trim();

      if (
        !line
        || line.startsWith("#")
        || !line.includes("=")
      ) {
        continue;
      }

      const index =
        line.indexOf("=");

      const key =
        line
          .slice(0, index)
          .trim();

      const value =
        line
          .slice(index + 1)
          .trim();

      if (
        key ===
          "AGENTBOUNTY_INTERNAL_KEY"
        && value
      ) {
        return value;
      }
    }
  }

  throw new Error(
    "AGENTBOUNTY_INTERNAL_KEY missing"
  );
}

async function runOnce() {
  const internalKey =
    loadInternalKey();

  const response =
    await fetch(
      `${PLATFORM_URL}/api/v1/system/verification-queue`,
      {
        method: "POST",

        headers: {
          "x-internal-key":
            internalKey,

          "content-type":
            "application/json",
        },

        signal:
          AbortSignal.timeout(
            60_000
          ),
      }
    );

  const text =
    await response.text();

  if (
    !response.ok
  ) {
    throw new Error(
      `HTTP ${response.status}: ${text}`
    );
  }

  return text
    ? JSON.parse(text)
    : {};
}

async function main() {
  console.log(
    "AgentBounty Verification Worker"
  );

  console.log(
    `Platform: ${PLATFORM_URL}`
  );

  console.log(
    `Polling every ${INTERVAL_SECONDS}s`
  );

  while (true) {
    try {
      const data =
        await runOnce();

      const scanned =
        data.scanned ?? 0;

      if (scanned) {
        console.log(
          `[verification] scanned ${scanned} task(s)`
        );

        for (
          const item
          of data.results ?? []
        ) {
          const taskId =
            item.taskId ?? "?";

          const result =
            item.verificationStatus
            ?? item.error
            ?? "unknown";

          const suffix =
            item.status
              ? ` -> ${item.status}`
              : "";

          console.log(
            `  ${taskId}: ${result}${suffix}`
          );
        }
      }
    } catch (error) {
      console.error(
        "[verification] error:",
        error instanceof Error
          ? error.message
          : String(error)
      );
    }

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          INTERVAL_SECONDS * 1000
        )
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
