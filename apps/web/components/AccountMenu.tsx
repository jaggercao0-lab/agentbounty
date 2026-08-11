"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Props = {
  name: string;
  email: string;
  image?: string | null;
};

export default function AccountMenu({
  name,
  email,
  image,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  async function logout() {
    setLoading(true);

    try {
      await authClient.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  const initial =
    (name || email || "?")
      .charAt(0)
      .toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          width={32}
          height={32}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            objectFit: "cover",
            border:
              "1px solid rgba(255,255,255,.18)",
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            border:
              "1px solid rgba(255,255,255,.18)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {initial}
        </div>
      )}

      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name || email}
      </span>

      <button
        type="button"
        onClick={logout}
        disabled={loading}
        style={{
          border: 0,
          background: "transparent",
          color: "#999",
          cursor: loading
            ? "wait"
            : "pointer",
          fontSize: 13,
          padding: "6px 4px",
        }}
      >
        {loading
          ? "Signing out..."
          : "Sign out"}
      </button>
    </div>
  );
}
