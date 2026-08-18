"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";
import { reviewSubmission } from "./actions";

type Props = {
  taskId: string;
  status: string;
  verificationType: string;
  locale: Locale;
};

export default function OwnerTaskActions({
  taskId,
  status,
  verificationType,
  locale,
}: Props) {
  const router = useRouter();
  const copy = extraTranslations[locale].task.owner;
  const taskCopy = extraTranslations[locale].task;

  const [loading, setLoading] =
    useState<"verify" | "pay" | null>(null);
  const [message, setMessage] = useState("");

  async function retryVerification() {
    setLoading("verify");
    setMessage("");

    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}/verify`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || copy.retryFailed);
        return;
      }

      if (data.pending === true) {
        setMessage(copy.checksRunning);
      } else if (data.passed === true) {
        setMessage(
          data.status === "VERIFYING"
            ? taskCopy.hybridReviewHelp
            : copy.verified
        );
      } else if (data.status === "REVISION") {
        setMessage(copy.revision);
      } else if (data.status === "CANCELLED") {
        setMessage(copy.exhausted);
      } else {
        setMessage(copy.completed);
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage(copy.unableRetry);
    } finally {
      setLoading(null);
    }
  }

  async function releasePayment() {
    setLoading("pay");
    setMessage("");

    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}/pay`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || copy.paymentFailed);
        return;
      }

      setMessage(copy.paymentReleased);
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage(copy.unablePayment);
    } finally {
      setLoading(null);
    }
  }

  const awaitingOwnerReview =
    (verificationType === "MANUAL" && status === "SUBMITTED") ||
    (verificationType === "HYBRID" && status === "VERIFYING");

  if (awaitingOwnerReview) {
    return (
      <section className="ab-auto-verify">
        <div className="ab-auto-verify-head">
          <div className="ab-auto-verify-signal">
            <i />
          </div>

          <div>
            <span>{taskCopy.reviewDelivery}</span>
            <h3>
              {verificationType === "HYBRID"
                ? taskCopy.hybridReviewHelp
                : taskCopy.manualReviewHelp}
            </h3>
          </div>
        </div>

        <div className="ab-owner-review-actions">
          <form action={reviewSubmission}>
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="decision" value="ACCEPT" />
            <button
              type="submit"
              className="ab-settlement-button"
            >
              {taskCopy.approveDelivery}
            </button>
          </form>

          <form action={reviewSubmission}>
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="decision" value="REVISION" />
            <button
              type="submit"
              className="ab-auto-verify-retry"
            >
              {taskCopy.requestRevision}
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (status === "SUBMITTED") {
    return (
      <section className="ab-auto-verify">
        <div className="ab-auto-verify-head">
          <div className="ab-auto-verify-signal">
            <i />
          </div>

          <div>
            <span>{copy.automatic}</span>
            <h3>{copy.monitoring}</h3>
          </div>
        </div>

        <div className="ab-auto-verify-terminal">
          <div>
            <span>{copy.status}</span>
            <strong>{copy.watching}</strong>
          </div>

          <div>
            <span>{copy.source}</span>
            <strong>{verificationType}</strong>
          </div>

          <div>
            <span>{copy.poll}</span>
            <strong>~15 SEC</strong>
          </div>
        </div>

        <p className="ab-auto-verify-copy">
          {copy.verifyCopy}
        </p>

        <div className="ab-auto-verify-flow">
          <span>{verificationType === "GITHUB" ? "PR" : "OUTPUT"}</span>
          <i>→</i>
          <span>{verificationType === "GITHUB" ? "CI" : "RULES"}</span>
          <i>→</i>
          <span>{copy.verify}</span>
          <i>→</i>
          <span>
            {verificationType === "HYBRID"
              ? taskCopy.reviewDelivery
              : copy.accept}
          </span>
        </div>

        <button
          type="button"
          className="ab-auto-verify-retry"
          disabled={!!loading}
          onClick={retryVerification}
        >
          {loading === "verify"
            ? copy.checking
            : copy.retry}
        </button>

        {message && (
          <p className="ab-auto-verify-message">
            {message}
          </p>
        )}
      </section>
    );
  }

  if (status !== "ACCEPTED") {
    return null;
  }

  return (
    <section className="ab-settlement-control">
      <div className="ab-settlement-control-head">
        <span>{copy.ownerControl}</span>
        <h3>{copy.contractVerified}</h3>
      </div>

      <div className="ab-settlement-ready">
        <i>✓</i>
        <div>
          <strong>{copy.ready}</strong>
          <span>{copy.evidencePassed}</span>
        </div>
      </div>

      <button
        type="button"
        className="ab-settlement-button"
        disabled={!!loading}
        onClick={releasePayment}
      >
        {loading === "pay"
          ? copy.releasing
          : copy.release}
      </button>

      {message && (
        <p className="ab-auto-verify-message">
          {message}
        </p>
      )}
    </section>
  );
}
