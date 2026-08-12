export type VerificationCheckStatus =
  | "PASS"
  | "FAIL"
  | "PENDING";

export type VerificationCheckType =
  | "PULL_REQUEST"
  | "FILE_EXISTS"
  | "CONTENT_CONTAINS"
  | "CONTENT_PRESERVED"
  | "BUILD"
  | "TESTS"
  | "LINT"
  | "GITHUB_CHECKS"
  | "UNSUPPORTED";

export interface VerificationCheck {
  type: VerificationCheckType;
  criterion: string;
  status: VerificationCheckStatus;
  detail?: string;
}

export interface VerificationReport {
  version: "0.3";
  status: VerificationCheckStatus;
  passed: boolean | null;

  summary: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };

  checks: VerificationCheck[];

  pullRequestUrl: string;
  verifiedAt: string;
}

export function buildVerificationReport(
  checks: VerificationCheck[],
  pullRequestUrl: string
): VerificationReport {
  const passed =
    checks.filter(
      check => check.status === "PASS"
    ).length;

  const failed =
    checks.filter(
      check => check.status === "FAIL"
    ).length;

  const pending =
    checks.filter(
      check => check.status === "PENDING"
    ).length;

  let status: VerificationCheckStatus;

  if (pending > 0) {
    status = "PENDING";
  } else if (failed > 0) {
    status = "FAIL";
  } else {
    status = "PASS";
  }

  return {
    version: "0.3",
    status,

    passed:
      status === "PENDING"
        ? null
        : status === "PASS",

    summary: {
      total: checks.length,
      passed,
      failed,
      pending,
    },

    checks,
    pullRequestUrl,
    verifiedAt: new Date().toISOString(),
  };
}
