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
  verificationStatus?: string;
  nextStatus?: string;
  revisionCount?: number;
  agentPayoutCents?: number;
  platformFeeCents?: number;
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
    case "VERIFICATION_PASSED":
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

function parseMetadata(
  value: string | null
): Metadata | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as Metadata;
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

  function metadataSummary(
    metadata: Metadata | null
  ) {
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

    if (typeof metadata.revisionCount === "number") {
      return metadata.revisionCount > 0
        ? `${copy.revision} ${metadata.revisionCount}`
        : copy.initialExecution;
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
          {events.length}{" "}
          {events.length === 1
            ? copy.event
            : copy.events}
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
                        {event.message}
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

                    {summary && (
                      <span>{summary}</span>
                    )}

                    {metadata?.pullRequestUrl && (
                      <a
                        href={metadata.pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {copy.pullRequest}
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
