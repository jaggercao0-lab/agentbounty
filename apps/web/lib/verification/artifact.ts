type ArtifactSubmission = {
  deliveryType: string;
  pullRequestUrl: string | null;
  artifactUrl: string | null;
  textContent: string | null;
  jsonContent: string | null;
  mimeType: string | null;
};

type CheckStatus = "PASS" | "FAIL" | "PENDING";

type ArtifactCheck = {
  type: string;
  criterion: string;
  status: CheckStatus;
  detail?: string;
};

function urlIsHttps(value: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function fileExtension(url: string | null) {
  if (!url) return "";

  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop() || "";
    const index = last.lastIndexOf(".");
    return index >= 0 ? last.slice(index + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

function supportedCheck(
  criterion: string,
  submission: ArtifactSubmission
): ArtifactCheck | null {
  const raw = criterion.trim();

  const textLength = raw.match(/^TEXT MIN LENGTH:\s*(\d+)$/i);
  if (textLength) {
    const required = Number(textLength[1]);
    const actual = submission.textContent?.trim().length || 0;

    return {
      type: "TEXT_MIN_LENGTH",
      criterion: raw,
      status: actual >= required ? "PASS" : "FAIL",
      detail: `${actual} characters submitted; ${required} required.`,
    };
  }

  if (/^URL REQUIRED$/i.test(raw)) {
    const value =
      submission.deliveryType === "PULL_REQUEST"
        ? submission.pullRequestUrl
        : submission.artifactUrl;

    return {
      type: "URL_REQUIRED",
      criterion: raw,
      status: urlIsHttps(value) ? "PASS" : "FAIL",
      detail: urlIsHttps(value)
        ? "HTTPS delivery URL is present."
        : "A valid HTTPS delivery URL is required.",
    };
  }

  if (/^FILE REQUIRED$/i.test(raw)) {
    const present = urlIsHttps(submission.artifactUrl);
    return {
      type: "FILE_REQUIRED",
      criterion: raw,
      status: present ? "PASS" : "FAIL",
      detail: present
        ? "Artifact URL is present."
        : "A downloadable HTTPS artifact URL is required.",
    };
  }

  const extensionMatch = raw.match(/^FILE EXTENSION:\s*([a-z0-9]+)$/i);
  if (extensionMatch) {
    const expected = extensionMatch[1].toLowerCase();
    const actual = fileExtension(submission.artifactUrl);

    return {
      type: "FILE_EXTENSION",
      criterion: raw,
      status: actual === expected ? "PASS" : "FAIL",
      detail: actual
        ? `Artifact extension is .${actual}; .${expected} required.`
        : `Artifact URL does not expose a .${expected} extension.`,
    };
  }

  if (/^JSON REQUIRED$/i.test(raw)) {
    let valid = false;

    if (submission.jsonContent) {
      try {
        JSON.parse(submission.jsonContent);
        valid = true;
      } catch {
        valid = false;
      }
    }

    return {
      type: "JSON_REQUIRED",
      criterion: raw,
      status: valid ? "PASS" : "FAIL",
      detail: valid
        ? "JSON delivery parsed successfully."
        : "A valid JSON delivery is required.",
    };
  }

  const mimeMatch = raw.match(/^MIME TYPE:\s*(\S+)$/i);
  if (mimeMatch) {
    const expected = mimeMatch[1].toLowerCase();
    const actual = (submission.mimeType || "").toLowerCase();

    return {
      type: "MIME_TYPE",
      criterion: raw,
      status: actual === expected ? "PASS" : "FAIL",
      detail: actual
        ? `Submitted MIME type is ${actual}; ${expected} required.`
        : `MIME type ${expected} is required.`,
    };
  }

  return null;
}

export function runArtifactVerification({
  submission,
  criteria,
  allowManualCriteria,
}: {
  submission: ArtifactSubmission;
  criteria: string[];
  allowManualCriteria: boolean;
}) {
  const checks: ArtifactCheck[] = [];
  const unsupported: string[] = [];

  for (const criterion of criteria) {
    const check = supportedCheck(criterion, submission);

    if (check) {
      checks.push(check);
    } else {
      unsupported.push(criterion);
    }
  }

  if (!allowManualCriteria) {
    for (const criterion of unsupported) {
      checks.push({
        type: "UNSUPPORTED",
        criterion,
        status: "FAIL",
        detail:
          "This criterion is not supported by deterministic artifact verification.",
      });
    }
  }

  const failed = checks.filter(check => check.status === "FAIL").length;
  const pending = checks.filter(check => check.status === "PENDING").length;
  const passed = checks.filter(check => check.status === "PASS").length;

  const status: CheckStatus =
    failed > 0
      ? "FAIL"
      : pending > 0
        ? "PENDING"
        : "PASS";

  return {
    version: "0.4",
    status,
    passed: status === "PENDING" ? null : status === "PASS",
    summary: {
      total: checks.length,
      passed,
      failed,
      pending,
    },
    checks,
    pullRequestUrl: submission.pullRequestUrl || "",
    verifiedAt: new Date().toISOString(),
    manualCriteria: allowManualCriteria ? unsupported : [],
  };
}
