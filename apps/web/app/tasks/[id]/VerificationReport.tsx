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

  status:
    | "PASS"
    | "FAIL"
    | "PENDING";

  passed:
    | boolean
    | null;

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
  reportJson:
    | string
    | null;

  verificationStatus:
    | string
    | null;

  taskStatus: string;
};

function parseReport(
  value: string | null
): VerificationReportData | null {
  if (!value) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(
        parsed.checks
      ) ||
      !parsed.summary
    ) {
      return null;
    }

    return parsed as VerificationReportData;
  } catch {
    return null;
  }
}

function resultCopy(
  status: string,
  taskStatus: string
) {
  if (status === "PASS") {
    return {
      kicker:
        "CONTRACT VERIFIED",

      title:
        "Acceptance contract passed.",

      symbol:
        "✓",
    };
  }

  if (
    status === "PENDING"
  ) {
    return {
      kicker:
        "VERIFICATION PENDING",

      title:
        "Waiting for GitHub checks.",

      symbol:
        "◌",
    };
  }

  if (
    taskStatus ===
    "REVISION"
  ) {
    return {
      kicker:
        "REVISION REQUIRED",

      title:
        "Acceptance contract did not pass.",

      symbol:
        "↻",
    };
  }

  if (
    taskStatus ===
    "CANCELLED"
  ) {
    return {
      kicker:
        "CONTRACT FAILED",

      title:
        "Verification failed and revisions are exhausted.",

      symbol:
        "×",
    };
  }

  return {
    kicker:
      "VERIFICATION FAILED",

    title:
      "Acceptance contract did not pass.",

    symbol:
      "×",
  };
}

function checkSymbol(
  status: CheckStatus
) {
  if (
    status === "PASS"
  ) {
    return "✓";
  }

  if (
    status === "PENDING"
  ) {
    return "◌";
  }

  return "×";
}

function friendlyType(
  type: string
) {
  return type
    .replace(
      /_/g,
      " "
    )
    .toLowerCase();
}

export default function VerificationReport({
  reportJson,
  verificationStatus,
  taskStatus,
}: Props) {
  const report =
    parseReport(
      reportJson
    );

  if (!report) {
    return null;
  }

  const status =
    report.status ||
    verificationStatus ||
    "FAIL";

  const result =
    resultCopy(
      status,
      taskStatus
    );

  const total =
    Math.max(
      report.summary.total,
      0
    );

  const progress =
    total > 0
      ? Math.round(
          (
            report.summary.passed /
            total
          ) * 100
        )
      : 0;

  let verifiedDate =
    "";

  try {
    verifiedDate =
      new Date(
        report.verifiedAt
      ).toLocaleString();
  } catch {
    verifiedDate =
      report.verifiedAt;
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
            VERIFICATION ENGINE
          </span>

          <h2>
            Deterministic contract report
          </h2>
        </div>

        <div className="ab-verify-version">
          ENGINE {report.version || "0.3"}
        </div>

      </div>

      <div className="ab-verify-overview">

        <div className="ab-verify-score">

          <strong>
            {report.summary.passed}
            <span>
              /{total}
            </span>
          </strong>

          <div>
            <span>
              CHECKS PASSED
            </span>

            <small>
              {progress}% deterministic confidence
            </small>
          </div>

        </div>

        <div
          className="ab-verify-status-chip"
        >
          <i />

          {status}
        </div>

      </div>

      <div className="ab-verify-progress">
        <div
          style={{
            width:
              `${progress}%`,
          }}
        />
      </div>

      <div className="ab-verify-summary-grid">

        <div>
          <span>
            PASS
          </span>

          <strong>
            {report.summary.passed}
          </strong>
        </div>

        <div>
          <span>
            FAIL
          </span>

          <strong>
            {report.summary.failed}
          </strong>
        </div>

        <div>
          <span>
            PENDING
          </span>

          <strong>
            {report.summary.pending}
          </strong>
        </div>

        <div>
          <span>
            TOTAL
          </span>

          <strong>
            {total}
          </strong>
        </div>

      </div>

      <div className="ab-verify-checks">

        {report.checks.map(
          (
            check,
            index
          ) => (
            <div
              key={
                `${check.type}-${index}`
              }
              className={
                "ab-verify-check " +
                `ab-verify-check-${check.status.toLowerCase()}`
              }
            >
              <div className="ab-verify-check-icon">
                {checkSymbol(
                  check.status
                )}
              </div>

              <div className="ab-verify-check-copy">

                <div className="ab-verify-check-top">

                  <strong>
                    {check.criterion}
                  </strong>

                  <span>
                    {friendlyType(
                      check.type
                    )}
                  </span>

                </div>

                {check.detail && (
                  <p>
                    {check.detail}
                  </p>
                )}

              </div>

              <div className="ab-verify-check-state">
                {check.status}
              </div>

            </div>
          )
        )}

      </div>

      <footer className="ab-verify-result">

        <div className="ab-verify-result-symbol">
          {result.symbol}
        </div>

        <div>
          <span>
            {result.kicker}
          </span>

          <strong>
            {result.title}
          </strong>
        </div>

        <time>
          {verifiedDate}
        </time>

      </footer>
    </section>
  );
}
