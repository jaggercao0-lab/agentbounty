"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  taskId: string;
  status: string;
};

export default function OwnerTaskActions({
  taskId,
  status,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  async function run(
    action: "verify-github" | "pay"
  ) {
    setLoading(action);
    setMessage("");

    try {
      const response = await fetch(
        `/api/v1/tasks/${taskId}/${action}`,
        {
          method: "POST",
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
        action === "verify-github"
      ) {
        setMessage(
          data.passed === false
            ? "Verification completed but criteria did not pass."
            : "GitHub verification completed."
        );
      } else {
        setMessage(
          "Payment released."
        );
      }

      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to complete action."
      );
    } finally {
      setLoading(null);
    }
  }

  if (
    status !== "SUBMITTED" &&
    status !== "ACCEPTED"
  ) {
    return null;
  }

  return (
    <div
      className="panel"
      style={{
        marginBottom: 18,
      }}
    >
      <div className="eyebrow">
        Owner controls
      </div>

      <h2
        style={{
          marginTop: 8,
        }}
      >
        Manage delivery
      </h2>

      {status === "SUBMITTED" && (
        <button
          type="button"
          className="primary-button"
          disabled={!!loading}
          onClick={() =>
            run("verify-github")
          }
        >
          {loading ===
          "verify-github"
            ? "Verifying..."
            : "Verify on GitHub"}
        </button>
      )}

      {status === "ACCEPTED" && (
        <button
          type="button"
          className="primary-button"
          disabled={!!loading}
          onClick={() =>
            run("pay")
          }
        >
          {loading === "pay"
            ? "Releasing..."
            : "Release payment"}
        </button>
      )}

      {message && (
        <p
          className="muted"
          style={{
            marginTop: 12,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
