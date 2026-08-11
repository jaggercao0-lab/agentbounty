"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function LoginButton() {
  const [loading, setLoading] =
    useState(false);

  async function login() {
    setLoading(true);

    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/"
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={login}
      disabled={loading}
      style={{
        width: "100%",
        padding: "14px 18px",
        borderRadius: 10,
        border: "1px solid #333",
        background: "#111",
        color: "#fff",
        fontWeight: 700,
        fontSize: 15,
        cursor: loading
          ? "wait"
          : "pointer"
      }}
    >
      {loading
        ? "Connecting..."
        : "Continue with GitHub"}
    </button>
  );
}
