import { db } from "@agentbounty/database";
import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";
import { getWebSession } from "@/lib/web-session";
import MarkdownDelivery from "./MarkdownDelivery";

type Props = {
  submission: {
    taskId: string;
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

type ResearchSource = {
  id: string;
  title: string;
  url: string;
};

function safeResearchSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
    )
    .map(item => ({
      id: typeof item.id === "string" ? item.id : "",
      title: typeof item.title === "string" ? item.title : "",
      url: typeof item.url === "string" ? item.url : "",
    }))
    .filter(item => {
      if (!item.id || !item.title || !item.url) return false;

      try {
        const parsed = new URL(item.url);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    })
    .slice(0, 20);
}

export default async function TaskDelivery({
  submission,
  locale,
}: Props) {
  const copy = extraTranslations[locale].task;
  const label =
    copy.deliveryLabels?.[submission.deliveryType] ||
    submission.deliveryType;

  const session = await getWebSession();
  const task = await db.task.findUnique({
    where: { id: submission.taskId },
    select: { ownerId: true },
  });

  const canRevealPrivateDelivery = Boolean(
    task && session?.user?.id === task.ownerId
  );

  let metadata: Record<string, unknown> | null = null;
  if (
    canRevealPrivateDelivery &&
    submission.metadataJson
  ) {
    try {
      metadata = JSON.parse(submission.metadataJson);
    } catch {
      metadata = null;
    }
  }

  const researchSources = safeResearchSources(
    metadata?.researchSources
  );
  const researchMode =
    typeof metadata?.researchMode === "string"
      ? metadata.researchMode
      : null;
  const searchProvider =
    typeof metadata?.searchProvider === "string"
      ? metadata.searchProvider
      : null;
  const rawSearchQueries = metadata?.searchQueries;
  const searchQueries = Array.isArray(rawSearchQueries)
    ? rawSearchQueries
        .filter(
          (value): value is string => typeof value === "string"
        )
        .slice(0, 8)
    : [];

  const genericMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([key]) =>
          ![
            "researchSources",
            "researchMode",
            "searchProvider",
            "searchQueries",
            "sourceCount",
          ].includes(key)
        )
      )
    : null;

  const privateDelivery =
    submission.deliveryType !== "PULL_REQUEST";

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

        {canRevealPrivateDelivery &&
          ["FILE", "URL"].includes(submission.deliveryType) &&
          submission.artifactUrl && (
            <a
              href={submission.artifactUrl}
              target="_blank"
              rel="noreferrer"
            >
              {submission.artifactUrl} ↗
            </a>
          )}

        {canRevealPrivateDelivery &&
          submission.deliveryType === "TEXT" && (
            <div className="ab-general-delivery-content">
              <MarkdownDelivery
                content={submission.textContent || ""}
              />
            </div>
          )}

        {canRevealPrivateDelivery &&
          submission.deliveryType === "JSON" && (
            <pre className="ab-general-delivery-code">
              {submission.jsonContent || "{}"}
            </pre>
          )}

        {privateDelivery &&
          !canRevealPrivateDelivery && (
            <div className="ab-general-delivery-private">
              {locale === "zh"
                ? "交付内容仅任务发布者可见。"
                : "Delivery content is visible only to the task owner."}
            </div>
          )}
      </div>

      {canRevealPrivateDelivery && researchMode && (
        <div className="ab-research-evidence">
          <div className="ab-research-evidence-head">
            <div>
              <span>
                {locale === "zh" ? "调研证据" : "Research evidence"}
              </span>
              <strong>
                {researchMode === "web_grounded"
                  ? locale === "zh"
                    ? "已联网检索"
                    : "Web-grounded"
                  : locale === "zh"
                    ? "仅模型知识"
                    : "Model-only"}
              </strong>
            </div>

            {searchProvider && (
              <span className="ab-research-provider">
                {searchProvider}
              </span>
            )}
          </div>

          {searchQueries.length > 0 && (
            <div className="ab-research-queries">
              {searchQueries.map((query, index) => (
                <span key={`${query}-${index}`}>{query}</span>
              ))}
            </div>
          )}

          {researchSources.length > 0 ? (
            <div className="ab-research-sources">
              {researchSources.map(source => (
                <a
                  key={`${source.id}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{source.id}</span>
                  <strong>{source.title}</strong>
                  <small>{source.url}</small>
                </a>
              ))}
            </div>
          ) : (
            <p className="ab-research-no-sources">
              {locale === "zh"
                ? "本次交付没有附带实时网页来源。"
                : "No live web sources were attached to this delivery."}
            </p>
          )}
        </div>
      )}

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

      {genericMetadata && Object.keys(genericMetadata).length > 0 && (
        <div className="ab-general-delivery-meta">
          <span>METADATA</span>
          <pre>{JSON.stringify(genericMetadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
