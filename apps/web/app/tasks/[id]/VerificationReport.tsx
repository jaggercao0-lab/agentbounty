import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";

type CheckStatus =
  | "PASS"
  | "FAIL"
  | "PENDING";

type VerificationCheck = {
  type: string;
  criterion: string;
  status: CheckStatus;
  detail?: string;
};

type VerificationReportData = {
  version: string;
  status: "PASS" | "FAIL" | "PENDING";
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
};

type Props = {
  reportJson: string | null;
  verificationStatus: string | null;
  taskStatus: string;
  locale: Locale;
};

function parseReport(
  value: string | null
): VerificationReportData | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.checks) ||
      !parsed.summary
    ) {
      return null;
    }

    return parsed as VerificationReportData;
  } catch {
    return null;
  }
}

function checkSymbol(status: CheckStatus) {
  if (status === "PASS") return "✓";
  if (status === "PENDING") return "◌";
  return "×";
}

function friendlyType(type: string) {
  return type
    .replace(/_/g, " ")
    .toLowerCase();
}

export default function VerificationReport({
  reportJson,
  verificationStatus,
  taskStatus,
  locale,
}: Props) {
  const report = parseReport(reportJson);

  if (!report) {
    return null;
  }

  const copy = extraTranslations[locale].task.verification;
  const statusCopy = extraTranslations[locale].status;

  const status =
    report.status ||
    verificationStatus ||
    "FAIL";

  const result =
    status === "PASS"
      ? {
          kicker: copy.contractVerified,
          title: copy.contractPassed,
          symbol: "✓",
        }
      : status === "PENDING"
        ? {
            kicker: copy.verificationPending,
            title: copy.waitingChecks,
            symbol: "◌",
          }
        : taskStatus === "REVISION"
          ? {
              kicker: copy.revisionRequired,
              title: copy.didNotPass,
              symbol: "↻",
            }
          : taskStatus === "CANCELLED"
            ? {
                kicker: copy.contractFailed,
                title: copy.exhausted,
                symbol: "×",
              }
            : {
                kicker: copy.verificationFailed,
                title: copy.didNotPass,
                symbol: "×",
              };

  const total = Math.max(report.summary.total, 0);

  const progress =
    total > 0
      ? Math.round(
          (report.summary.passed / total) * 100
        )
      : 0;

  let verifiedDate = "";

  try {
    verifiedDate = new Date(
      report.verifiedAt
    ).toLocaleString(
      locale === "zh" ? "zh-CN" : "en"
    );
  } catch {
    verifiedDate = report.verifiedAt;
  }

  return (
    <section
      className={
        "ab-verify-panel " +
        `ab-verify-${status.toLowerCase()}`
      }
    >
      <div className="ab-verify-head">
        <div>
          <span className="ab-verify-eyebrow">
            {copy.engine}
          </span>
          <h2>{copy.report}</h2>
        </div>

        <div className="ab-verify-version">
          {copy.engineVersion} {report.version || "0.3"}
        </div>
      </div>

      <div className="ab-verify-overview">
        <div className="ab-verify-score">
          <strong>
            {report.summary.passed}
            <span>/{total}</span>
          </strong>

          <div>
            <span>{copy.checksPassed}</span>
            <small>
              {progress}% {copy.confidence}
            </small>
          </div>
        </div>

        <div className="ab-verify-status-chip">
          <i />
          {statusCopy[status as keyof typeof statusCopy] || status}
        </div>
      </div>

      <div className="ab-verify-progress">
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="ab-verify-summary-grid">
        <div>
          <span>{copy.pass}</span>
          <strong>{report.summary.passed}</strong>
        </div>
        <div>
          <span>{copy.fail}</span>
          <strong>{report.summary.failed}</strong>
        </div>
        <div>
          <span>{copy.pending}</span>
          <strong>{report.summary.pending}</strong>
        </div>
        <div>
          <span>{copy.total}</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="ab-verify-checks">
        {report.checks.map((check, index) => (
          <div
            key={`${check.type}-${index}`}
            className={
              "ab-verify-check " +
              `ab-verify-check-${check.status.toLowerCase()}`
            }
          >
            <div className="ab-verify-check-icon">
              {checkSymbol(check.status)}
            </div>

            <div className="ab-verify-check-copy">
              <div className="ab-verify-check-top">
                <strong>{check.criterion}</strong>
                <span>{friendlyType(check.type)}</span>
              </div>

              {check.detail && (
                <p>{check.detail}</p>
              )}
            </div>

            <div className="ab-verify-check-state">
              {statusCopy[check.status] || check.status}
            </div>
          </div>
        ))}
      </div>

      <footer className="ab-verify-result">
        <div className="ab-verify-result-symbol">
          {result.symbol}
        </div>

        <div>
          <span>{result.kicker}</span>
          <strong>{result.title}</strong>
        </div>

        <time>{verifiedDate}</time>
      </footer>
    </section>
  );
}
