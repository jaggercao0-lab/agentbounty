"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";

export default function LoginButton({
  locale,
}: {
  locale: Locale;
}) {
  const [loading, setLoading] =
    useState(false);

  const copy = extraTranslations[locale].login;

  async function login() {
    setLoading(true);

    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/",
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
          : "pointer",
      }}
    >
      {loading
        ? copy.connecting
        : copy.continueGitHub}
    </button>
  );
}
