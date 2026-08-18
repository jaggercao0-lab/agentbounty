"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";

import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  label: string;
};

export default function LanguageSwitcher({
  locale,
  label,
}: Props) {
  const router = useRouter();

  function handleChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const nextLocale = event.target.value === "zh" ? "zh" : "en";

    document.cookie = [
      `agentbounty_locale=${nextLocale}`,
      "path=/",
      "max-age=31536000",
      "samesite=lax",
    ].join("; ");

    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
    router.refresh();
  }

  return (
    <label
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid #303742",
        borderRadius: 8,
        padding: "6px 8px",
        background: "#111419",
        color: "#dce2e8",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      <span aria-hidden="true">◎</span>

      <select
        value={locale}
        onChange={handleChange}
        style={{
          border: 0,
          outline: 0,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
        }}
      >
        <option value="en">EN</option>
        <option value="zh">中文</option>
      </select>
    </label>
  );
}
