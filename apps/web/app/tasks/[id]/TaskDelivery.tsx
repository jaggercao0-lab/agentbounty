import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";

type Props = {
  submission: {
    deliveryType: string;
    pullRequestUrl: string | null;
    artifactUrl: string | null;
    textContent: string | null;
    jsonContent: string | null;
    mimeType: string | null;
    metadataJson: string | null;
    notes: string | null;
    createdAt: Date;
    ciPassed: boolean | null;
  };
  locale: Locale;
};

export default function TaskDelivery({
  submission,
  locale,
}: Props) {
  const copy = extraTranslations[locale].task;
  const label =
    copy.deliveryLabels?.[submission.deliveryType] ||
    submission.deliveryType;

  let metadata: Record<string, unknown> | null = null;
  if (submission.metadataJson) {
    try {
      metadata = JSON.parse(submission.metadataJson);
    } catch {
      metadata = null;
    }
  }

  return (
    <div className="ab-task-delivery ab-general-delivery">
      <div className="ab-general-delivery-main">
        <span>{label}</span>

        {submission.deliveryType === "PULL_REQUEST" &&
          submission.pullRequestUrl && (
            <a
              href={submission.pullRequestUrl}
              target="_blank"
              rel="noreferrer"
            >
              {submission.pullRequestUrl} ↗
            </a>
          )}

        {["FILE", "URL"].includes(submission.deliveryType) &&
          submission.artifactUrl && (
            <a
              href={submission.artifactUrl}
              target="_blank"
              rel="noreferrer"
            >
              {submission.artifactUrl} ↗
            </a>
          )}

        {submission.deliveryType === "TEXT" && (
          <div className="ab-general-delivery-content">
            {submission.textContent || "—"}
          </div>
        )}

        {submission.deliveryType === "JSON" && (
          <pre className="ab-general-delivery-code">
            {submission.jsonContent || "{}"}
          </pre>
        )}
      </div>

      <div>
        <span>{copy.submitted}</span>
        <strong>
          {submission.createdAt.toLocaleString(
            locale === "zh" ? "zh-CN" : "en"
          )}
        </strong>
      </div>

      {submission.deliveryType === "PULL_REQUEST" && (
        <div>
          <span>{copy.ciResult}</span>
          <strong>
            {submission.ciPassed === true
              ? copy.passed
              : submission.ciPassed === false
                ? copy.failed
                : copy.pending}
          </strong>
        </div>
      )}

      {submission.mimeType && (
        <div>
          <span>MIME</span>
          <strong>{submission.mimeType}</strong>
        </div>
      )}

      {metadata && Object.keys(metadata).length > 0 && (
        <div className="ab-general-delivery-meta">
          <span>METADATA</span>
          <pre>{JSON.stringify(metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
