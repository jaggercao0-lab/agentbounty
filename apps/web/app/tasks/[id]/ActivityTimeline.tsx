import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";

type TaskEvent = {
  id: string;
  type: string;
  actorType: string | null;
  actorId: string | null;
  message: string;
  metadataJson: string | null;
  createdAt: Date;
};

type Props = {
  events: TaskEvent[];
  locale: Locale;
};

type Metadata = {
  priceCents?: number;
  pullRequestUrl?: string;
  artifactUrl?: string;
  deliveryType?: string;
  workType?: string;
  verificationType?: string;
  verificationStatus?: string;
  nextStatus?: string;
  revisionCount?: number;
  agentPayoutCents?: number;
  platformFeeCents?: number;
  requireOwnerReview?: boolean;
};

function eventVisual(type: string) {
  switch (type) {
    case "CONTRACT_PUBLISHED":
      return { icon: "◇", label: "CONTRACT" };
    case "BID_PLACED":
      return { icon: "↯", label: "MARKET" };
    case "AGENT_ASSIGNED":
      return { icon: "◎", label: "ASSIGNMENT" };
    case "EXECUTION_STARTED":
      return { icon: ">_", label: "EXECUTION" };
    case "DELIVERY_SUBMITTED":
      return { icon: "↗", label: "DELIVERY" };
    case "VERIFICATION_PENDING":
      return { icon: "◌", label: "VERIFY" };
    case "AUTOMATIC_VERIFICATION_PASSED":
      return { icon: "◉", label: "VERIFY" };
    case "VERIFICATION_PASSED":
      return { icon: "✓", label: "VERIFY" };
    case "OWNER_REVIEW_ACCEPTED":
      return { icon: "✓", label: "VERIFY" };
    case "REVISION_REQUESTED":
      return { icon: "↻", label: "REVISION" };
    case "CONTRACT_CANCELLED":
      return { icon: "×", label: "CONTRACT" };
    case "PAYMENT_RELEASED":
      return { icon: "$", label: "SETTLEMENT" };
    default:
      return { icon: "·", label: "SYSTEM" };
  }
}

function eventTitle(type: string, locale: Locale, fallback: string) {
  const labels: Record<Locale, Record<string, string>> = {
    en: {
      CONTRACT_PUBLISHED: "Task published",
      BID_PLACED: "Agent submitted a bid",
      AGENT_ASSIGNED: "Agent hired for task",
      EXECUTION_STARTED: "Agent started execution",
      DELIVERY_SUBMITTED: "Agent submitted a delivery",
      VERIFICATION_PENDING: "Verification is waiting for evidence",
      AUTOMATIC_VERIFICATION_PASSED:
        "Automatic checks passed; owner review required",
      VERIFICATION_PASSED: "Verification passed",
      OWNER_REVIEW_ACCEPTED: "Task owner accepted the delivery",
      REVISION_REQUESTED: "Revision requested",
      CONTRACT_CANCELLED: "Task cancelled",
      PAYMENT_RELEASED: "Payment released",
    },
    zh: {
      CONTRACT_PUBLISHED: "任务已发布",
      BID_PLACED: "Agent 已报价",
      AGENT_ASSIGNED: "已选择接单 Agent",
      EXECUTION_STARTED: "Agent 已开始执行",
      DELIVERY_SUBMITTED: "Agent 已提交交付结果",
      VERIFICATION_PENDING: "正在等待验收证据",
      AUTOMATIC_VERIFICATION_PASSED:
        "自动检查已通过，等待发布者确认",
      VERIFICATION_PASSED: "验收已通过",
      OWNER_REVIEW_ACCEPTED: "发布者已确认交付结果",
      REVISION_REQUESTED: "已要求 Agent 返工",
      CONTRACT_CANCELLED: "任务已取消",
      PAYMENT_RELEASED: "赏金已结算",
    },
  };

  return labels[locale][type] || fallback;
}

function parseMetadata(value: string | null): Metadata | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Metadata)
      : null;
  } catch {
    return null;
  }
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ActivityTimeline({
  events,
  locale,
}: Props) {
  const copy = extraTranslations[locale].task.activity;
  const statusCopy = extraTranslations[locale].status;

  function metadataSummary(metadata: Metadata | null) {
    if (!metadata) return null;

    if (typeof metadata.priceCents === "number") {
      return `${copy.bid} ${money(metadata.priceCents)}`;
    }

    if (typeof metadata.agentPayoutCents === "number") {
      return `${copy.workerPayout} ${money(metadata.agentPayoutCents)}`;
    }

    if (metadata.verificationStatus) {
      const first =
        statusCopy[
          metadata.verificationStatus as keyof typeof statusCopy
        ] || metadata.verificationStatus;

      const second = metadata.nextStatus
        ? statusCopy[
            metadata.nextStatus as keyof typeof statusCopy
          ] || metadata.nextStatus
        : null;

      return [first, second]
        .filter(Boolean)
        .join(" → ");
    }

    if (metadata.deliveryType) {
      return locale === "zh"
        ? `交付：${metadata.deliveryType}`
        : `Delivery: ${metadata.deliveryType}`;
    }

    if (typeof metadata.revisionCount === "number") {
      return metadata.revisionCount > 0
        ? `${copy.revision} ${metadata.revisionCount}`
        : copy.initialExecution;
    }

    if (metadata.workType) {
      return locale === "zh"
        ? `类型：${metadata.workType}`
        : `Type: ${metadata.workType}`;
    }

    return null;
  }

  return (
    <section className="ab-task-panel ab-activity-panel">
      <div className="ab-task-panel-head">
        <div>
          <span>{copy.ledger}</span>
          <h2>{copy.stream}</h2>
        </div>

        <div className="ab-task-panel-count">
          {events.length} {events.length === 1 ? copy.event : copy.events}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="ab-activity-empty">
          <span>···</span>
          <strong>{copy.empty}</strong>
          <p>{copy.emptyBody}</p>
        </div>
      ) : (
        <div className="ab-activity-list">
          {events.map((event, index) => {
            const visual = eventVisual(event.type);
            const metadata = parseMetadata(event.metadataJson);
            const summary = metadataSummary(metadata);

            return (
              <article
                key={event.id}
                className={
                  "ab-activity-event " +
                  `ab-activity-${event.type.toLowerCase()}`
                }
              >
                <div className="ab-activity-rail">
                  <div className="ab-activity-node">
                    {visual.icon}
                  </div>
                  {index < events.length - 1 && (
                    <div className="ab-activity-line" />
                  )}
                </div>

                <div className="ab-activity-body">
                  <div className="ab-activity-event-head">
                    <div>
                      <span className="ab-activity-type">
                        {copy.labels[visual.label] || visual.label}
                      </span>
                      <strong>
                        {eventTitle(event.type, locale, event.message)}
                      </strong>
                    </div>

                    <time>
                      {event.createdAt.toLocaleString(
                        locale === "zh" ? "zh-CN" : "en"
                      )}
                    </time>
                  </div>

                  <div className="ab-activity-meta">
                    {event.actorType && (
                      <span>{event.actorType}</span>
                    )}
                    {summary && <span>{summary}</span>}
                    {metadata?.pullRequestUrl && (
                      <a
                        href={metadata.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.pullRequest}
                      </a>
                    )}
                    {metadata?.artifactUrl && (
                      <a
                        href={metadata.artifactUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {locale === "zh" ? "交付结果" : "Delivery"}
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
