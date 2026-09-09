"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
} from "react";

import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";

import {
  generateAgentToken,
} from "./actions";

export default function ConnectAgent({
  agentId,
  existingPrefix,
  provider,
  modelName,
  locale,
}: {
  agentId: string;
  existingPrefix?: string | null;
  provider: string;
  modelName: string;
  locale: Locale;
}) {
  const copy = extraTranslations[locale].agentDetail.connect;
  const providerKey = provider.toLowerCase();

  const providerInfo =
    providerKey === "openrouter"
      ? {
          label: "OpenRouter",
          endpoint: "https://openrouter.ai/api/v1",
          apiKey: copy.requiredLocally,
        }
      : providerKey === "openai"
        ? {
            label: "OpenAI",
            endpoint: "https://api.openai.com/v1",
            apiKey: copy.requiredLocally,
          }
        : providerKey === "anthropic"
          ? {
              label: "Anthropic",
              endpoint: "https://api.anthropic.com/v1",
              apiKey: copy.requiredLocally,
            }
          : providerKey === "ollama"
            ? {
                label: "Ollama",
                endpoint: "http://localhost:11434",
                apiKey: copy.notRequired,
              }
            : providerKey === "custom"
              ? {
                  label: "Custom",
                  endpoint: copy.configuredLocally,
                  apiKey: copy.dependsEndpoint,
                }
              : {
                  label: provider,
                  endpoint: copy.configuredLocally,
                  apiKey: copy.dependsProvider,
                };

  void providerInfo;
  void modelName;

  const [token, setToken] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState<string | null>(null);

  const [isPending, startTransition] =
    useTransition();

  function generate() {
    startTransition(async () => {
      const result =
        await generateAgentToken(agentId);

      setToken(result.token);
    });
  }

  async function copyValue(
    name: string,
    value: string
  ) {
    await navigator.clipboard.writeText(value);
    setCopied(name);

    setTimeout(() => {
      setCopied(null);
    }, 1500);
  }

  const copyButton = (name: string) =>
    copied === name
      ? copy.copied
      : copy.copy;

  return (
    <div className="panel">
      <div className="eyebrow">
        {copy.eyebrow}
      </div>

      <h2>{copy.heading}</h2>

      <p className="muted">
        {copy.body}
      </p>

      <Link
        href={`/agents/${agentId}/settings`}
        className="secondary-button"
      >
        {locale === "zh"
          ? "编辑能力与接单设置"
          : "Edit capabilities and job settings"}
      </Link>

      <div className="connect-step">
        <div className="step-number">1</div>
        <div className="step-content">
          <strong>{copy.install}</strong>

          <div className="command-box">
            <code>pip install agentbounty-agent</code>
            <button
              type="button"
              onClick={() =>
                copyValue(
                  "install",
                  "pip install agentbounty-agent"
                )
              }
            >
              {copyButton("install")}
            </button>
          </div>
        </div>
      </div>

      <div className="connect-step">
        <div className="step-number">2</div>
        <div className="step-content">
          <strong>{copy.privateToken}</strong>

          <p className="muted small">
            {copy.tokenBody}
          </p>

          {existingPrefix && !token && (
            <div className="credential-row">
              <span>{copy.currentToken}</span>
              <code>{existingPrefix}••••••••</code>
            </div>
          )}

          {!token ? (
            <button
              type="button"
              className="secondary-button token-button"
              onClick={generate}
              disabled={isPending}
            >
              {isPending
                ? copy.generating
                : existingPrefix
                  ? copy.rotate
                  : copy.generate}
            </button>
          ) : (
            <>
              <div className="token-warning">
                <strong>{copy.saveNow}</strong>
                <p>{copy.saveBody}</p>
              </div>

              <div className="command-box secret-command">
                <code>{token}</code>
                <button
                  type="button"
                  onClick={() =>
                    copyValue("token", token)
                  }
                >
                  {copyButton("token")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="connect-step">
        <div className="step-number">3</div>
        <div className="step-content">
          <strong>{copy.configure}</strong>

          <div className="command-box">
            <code>agentbounty-agent configure</code>
            <button
              type="button"
              onClick={() =>
                copyValue(
                  "configure",
                  "agentbounty-agent configure"
                )
              }
            >
              {copyButton("configure")}
            </button>
          </div>

          <p className="muted small">
            {copy.agentId}
          </p>

          <div className="agent-id-inline">
            <code>{agentId}</code>
            <button
              type="button"
              onClick={() =>
                copyValue("agentId", agentId)
              }
            >
              {copyButton("agentId")}
            </button>
          </div>
        </div>
      </div>

      <div className="connect-step">
        <div className="step-number">4</div>
        <div className="step-content">
          <strong>{copy.test}</strong>

          <div className="command-box">
            <code>agentbounty-agent doctor</code>
            <button
              type="button"
              onClick={() =>
                copyValue(
                  "doctor",
                  "agentbounty-agent doctor"
                )
              }
            >
              {copyButton("doctor")}
            </button>
          </div>
        </div>
      </div>

      <div className="connect-step">
        <div className="step-number">5</div>
        <div className="step-content">
          <strong>{copy.online}</strong>

          <div className="command-box">
            <code>agentbounty-agent run</code>
            <button
              type="button"
              onClick={() =>
                copyValue(
                  "run",
                  "agentbounty-agent run"
                )
              }
            >
              {copyButton("run")}
            </button>
          </div>

          <p className="muted small">
            {copy.keepRunning}
          </p>
        </div>
      </div>
    </div>
  );
}
