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
      string | null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState("");

  async function run(
    action:
      | "verify-github"
      | "pay"
  ) {
    setLoading(action);
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/v1/tasks/${taskId}/${action}`,
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
            "Action failed."
        );

        return;
      }

      if (
        action ===
        "verify-github"
      ) {
        if (
          data.pending ===
          true
        ) {
          setMessage(
            "GitHub checks are still running. Verification will need to be retried."
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
            "Verification completed but the acceptance contract did not pass."
          );
        }
      } else {
        setMessage(
          "Payment released."
        );
      }

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        "Unable to complete action."
      );
    } finally {
      setLoading(null);
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

  return (
    <div
      className="panel"
      style={{
        marginBottom:
          18,
      }}
    >
      <div className="eyebrow">
        Owner controls
      </div>

      <h2
        style={{
          marginTop:
            8,
        }}
      >
        Manage delivery
      </h2>

      {status ===
        "SUBMITTED" && (
        <button
          type="button"
          className="primary-button"
          disabled={
            !!loading
          }
          onClick={() =>
            run(
              "verify-github"
            )
          }
        >
          {loading ===
          "verify-github"
            ? "Verifying..."
            : "Run verification"}
        </button>
      )}

      {status ===
        "ACCEPTED" && (
        <button
          type="button"
          className="primary-button"
          disabled={
            !!loading
          }
          onClick={() =>
            run("pay")
          }
        >
          {loading ===
          "pay"
            ? "Releasing..."
            : "Release payment"}
        </button>
      )}

      {message && (
        <p
          className="muted"
          style={{
            marginTop:
              12,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
