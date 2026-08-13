"use client";

import {
  useRouter,
} from "next/navigation";

import {
  useState,
} from "react";

type Props = {
  taskId: string;
  status: string;
};

export default function OwnerTaskActions({
  taskId,
  status,
}: Props) {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState<
      "verify" |
      "pay" |
      null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState("");

  async function retryVerification() {
    setLoading(
      "verify"
    );

    setMessage("");

    try {
      const response =
        await fetch(
          `/api/v1/tasks/${taskId}/verify-github`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.error ||
            "Verification retry failed."
        );

        return;
      }

      if (
        data.pending ===
        true
      ) {
        setMessage(
          "GitHub checks are still running. Automatic verification will retry shortly."
        );
      } else if (
        data.passed ===
        true
      ) {
        setMessage(
          "Contract verified successfully."
        );
      } else if (
        data.status ===
        "REVISION"
      ) {
        setMessage(
          "Verification failed. A revision has been requested."
        );
      } else if (
        data.status ===
        "CANCELLED"
      ) {
        setMessage(
          "Verification failed and no revisions remain."
        );
      } else {
        setMessage(
          "Verification completed."
        );
      }

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        "Unable to retry verification."
      );
    } finally {
      setLoading(
        null
      );
    }
  }

  async function releasePayment() {
    setLoading(
      "pay"
    );

    setMessage("");

    try {
      const response =
        await fetch(
          `/api/v1/tasks/${taskId}/pay`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage(
          data.error ||
            "Payment failed."
        );

        return;
      }

      setMessage(
        "Payment released."
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        "Unable to release payment."
      );
    } finally {
      setLoading(
        null
      );
    }
  }

  if (
    status !==
      "SUBMITTED" &&
    status !==
      "ACCEPTED"
  ) {
    return null;
  }

  if (
    status ===
    "SUBMITTED"
  ) {
    return (
      <section className="ab-auto-verify">

        <div className="ab-auto-verify-head">

          <div className="ab-auto-verify-signal">
            <i />
          </div>

          <div>
            <span>
              AUTOMATIC VERIFICATION
            </span>

            <h3>
              Monitoring delivery
            </h3>
          </div>

        </div>

        <div className="ab-auto-verify-terminal">

          <div>
            <span>
              STATUS
            </span>

            <strong>
              WATCHING
            </strong>
          </div>

          <div>
            <span>
              SOURCE
            </span>

            <strong>
              GITHUB CI
            </strong>
          </div>

          <div>
            <span>
              POLL
            </span>

            <strong>
              ~15 SEC
            </strong>
          </div>

        </div>

        <p className="ab-auto-verify-copy">
          The verification worker is monitoring
          GitHub checks and will automatically
          evaluate the acceptance contract when
          evidence is ready.
        </p>

        <div className="ab-auto-verify-flow">
          <span>
            PR
          </span>

          <i>
            →
          </i>

          <span>
            CI
          </span>

          <i>
            →
          </i>

          <span>
            VERIFY
          </span>

          <i>
            →
          </i>

          <span>
            ACCEPT
          </span>
        </div>

        <button
          type="button"
          className="ab-auto-verify-retry"
          disabled={
            !!loading
          }
          onClick={
            retryVerification
          }
        >
          {loading ===
          "verify"
            ? "Checking now..."
            : "Retry now"}
        </button>

        {message && (
          <p className="ab-auto-verify-message">
            {message}
          </p>
        )}

      </section>
    );
  }

  return (
    <section className="ab-settlement-control">

      <div className="ab-settlement-control-head">
        <span>
          OWNER CONTROL
        </span>

        <h3>
          Contract verified
        </h3>
      </div>

      <div className="ab-settlement-ready">
        <i>
          ✓
        </i>

        <div>
          <strong>
            READY FOR SETTLEMENT
          </strong>

          <span>
            Verification evidence passed.
          </span>
        </div>
      </div>

      <button
        type="button"
        className="ab-settlement-button"
        disabled={
          !!loading
        }
        onClick={
          releasePayment
        }
      >
        {loading ===
        "pay"
          ? "Releasing..."
          : "Release payment"}
      </button>

      {message && (
        <p className="ab-auto-verify-message">
          {message}
        </p>
      )}

    </section>
  );
}
