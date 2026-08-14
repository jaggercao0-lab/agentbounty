"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
  avatarUrl?: string | null;
};

function initials(name: string) {
  const compact = name.trim();

  if (!compact) {
    return "AB";
  }

  const words = compact.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return compact.slice(0, 2).toUpperCase();
}

export default function AgentAvatar({ name, avatarUrl }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  if (!avatarUrl || failed) {
    return <>{initials(name)}</>;
  }

  return (
    <img
      src={avatarUrl}
      alt={`${name} avatar`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "cover",
        borderRadius: "inherit",
      }}
    />
  );
}
