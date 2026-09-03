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

type SourceFetchProof = {
  attempted: boolean;
  ok: boolean | null;
  url: string | null;
  finalUrl: string | null;
  contentType: string | null;
  truncated: boolean;
  error: string | null;
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

function safeSourceFetch(value: unknown): SourceFetchProof | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const attempted = raw.attempted === true;

  if (!attempted) return null;

  return {
    attempted,
    ok: typeof raw.ok === "boolean" ? raw.ok : null,
    url: typeof raw.url === "string" ? raw.url : null,
    finalUrl: typeof raw.finalUrl === "string" ? raw.finalUrl : null,
    contentType:
      typeof raw.contentType === "string" ? raw.contentType : null,
    truncated: raw.truncated === true,
    error: typeof raw.error === "string" ? raw.error : null,
  };
}

function safeLink(value: string | null) {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
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
    select: {
      ownerId: true,
      requestedActionsJson: true,
    },
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

  let requestedActions: string[] = [];
  if (task?.requestedActionsJson) {
    try {
      const parsed = JSON.parse(task.requestedActionsJson);
      requestedActions = Array.isArray(parsed)
        ? parsed.filter(
            (value): value is string => typeof value === "string"
          )
        : [];
    } catch {
      requestedActions = [];
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
  const sourceFetch = safeSourceFetch(metadata?.sourceFetch);
  const sourceProofLink = safeLink(
    sourceFetch?.finalUrl || sourceFetch?.url || null
  );

  const actionProofs = [
    ...(requestedActions.includes("WEB_SEARCH")
      ? [{
          action: "WEB_SEARCH",
          ok: researchMode === "web_grounded" && researchSources.length > 0,
          detail:
            researchMode === "web_grounded"
              ? locale === "zh"
                ? `收集到 ${researchSources.length} 个网页来源`
                : `${researchSources.length} web sources collected`
              : locale === "zh"
                ? "没有可验证的实时网页证据"
                : "No verifiable live web evidence",
        }]
      : []),
    ...(requestedActions.includes("SOURCE_FETCH")
      ? [{
          action: "SOURCE_FETCH",
          ok: sourceFetch?.ok === true,
          detail:
            sourceFetch?.ok === true
              ? sourceFetch.contentType ||
                (locale === "zh" ? "外部来源读取成功" : "External source fetched")
              : sourceFetch?.error ||
                (locale === "zh" ? "没有成功读取来源" : "Source fetch did not succeed"),
        }]
      : []),
  ];

  const genericMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([key]) =>
          ![
            "researchSources",
            "researchMode",
            "searchProvider",
            "searchQueries",
            "sourceCount",
            "sourceFetch",
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

      {canRevealPrivateDelivery && actionProofs.length > 0 && (
        <div className="ab-action-proof">
          <div className="ab-action-proof-head">
            <div>
              <span>{locale === "zh" ? "动作证明" : "ACTION PROOF"}</span>
              <strong>
                {locale === "zh"
                  ? "不是 Agent 自己说做过，而是运行器留下的执行证据"
                  : "Runner evidence that required actions actually happened"}
              </strong>
            </div>
            <b>
              {actionProofs.every(proof => proof.ok)
                ? locale === "zh" ? "✓ 已证明" : "✓ PROVEN"
                : locale === "zh" ? "! 未完成" : "! INCOMPLETE"}
            </b>
          </div>

          <div className="ab-action-proof-list">
            {actionProofs.map(proof => (
              <div key={proof.action} className="ab-action-proof-row">
                <span className={proof.ok ? "is-ok" : "is-failed"}>
                  {proof.ok ? "✓" : "!"}
                </span>
                <div>
                  <strong>
                    {proof.action === "WEB_SEARCH"
                      ? locale === "zh" ? "联网检索" : "Web search"
                      : locale === "zh" ? "读取外部来源" : "Source fetch"}
                  </strong>
                  <small>{proof.detail}</small>
                </div>
              </div>
            ))}
          </div>

          {sourceProofLink && (
            <a
              className="ab-action-proof-link"
              href={sourceProofLink}
              target="_blank"
              rel="noreferrer"
            >
              {locale === "zh" ? "查看读取来源" : "Open fetched source"} ↗
            </a>
          )}
        </div>
      )}

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
