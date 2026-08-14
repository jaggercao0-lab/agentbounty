"use client";

import { useState } from "react";
import AgentAvatar from "@/components/AgentAvatar";
import { createAgent } from "./actions";

const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter/free",
    hint: "Use models available through OpenRouter."
  },

  openai: {
    label: "OpenAI",
    defaultModel: "",
    hint: "Use an OpenAI model with your own API key."
  },

  anthropic: {
    label: "Anthropic",
    defaultModel: "",
    hint: "Use a Claude model with your own Anthropic API key."
  },

  ollama: {
    label: "Ollama",
    defaultModel: "",
    hint: "Run a local model through Ollama."
  },

  custom: {
    label: "Custom",
    defaultModel: "",
    hint: "Connect an OpenAI-compatible API endpoint."
  }
};

export default function AgentForm() {
  const [provider, setProvider] = useState("openrouter");
  const [modelName, setModelName] = useState("openrouter/free");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  function changeProvider(value) {
    setProvider(value);
    setModelName(PROVIDERS[value].defaultModel);
  }

  return (
    <form action={createAgent} className="task-form">
      <label>
        <span>Agent name</span>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="JaggerClaw"
          required
        />
      </label>

      <label>
        <span>Description</span>
        <textarea
          name="description"
          rows={4}
          placeholder="Autonomous coding agent..."
          required
        />
      </label>

      <div className="form-row">
        <label>
          <span>Avatar image URL</span>
          <input
            name="avatarUrl"
            type="url"
            inputMode="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.com/worker-avatar.webp"
          />
          <small>
            Optional. HTTPS only. Square JPG, PNG or WebP images work best.
          </small>
        </label>

        <div className="provider-info" style={{ alignSelf: "end" }}>
          <strong>Avatar preview</strong>
          <div
            style={{
              width: 72,
              height: 72,
              marginTop: 10,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              border: "1px solid #343d48",
              borderRadius: 10,
              background: "#12161b",
              color: "#dfe4ea",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 600,
            }}
          >
            <AgentAvatar name={name || "Agent"} avatarUrl={avatarUrl || null} />
          </div>
        </div>
      </div>

      <div className="form-row">
        <label>
          <span>Provider</span>
          <select
            name="provider"
            value={provider}
            onChange={(event) => changeProvider(event.target.value)}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label>
          <span>Model</span>
          <input
            name="modelName"
            value={modelName}
            onChange={(event) => setModelName(event.target.value)}
            placeholder={
              provider === "ollama"
                ? "qwen3-coder"
                : provider === "anthropic"
                  ? "Claude model name"
                  : provider === "openai"
                    ? "OpenAI model name"
                    : "Model name"
            }
            required
          />
        </label>

        <label>
          <span>Minimum job (USD)</span>
          <input
            name="minimumJob"
            type="number"
            min="0"
            step="0.01"
            defaultValue="2"
          />
        </label>
      </div>

      <div className="provider-info">
        <strong>{PROVIDERS[provider].label}</strong>
        <p>{PROVIDERS[provider].hint}</p>
        {provider === "ollama" ? (
          <p>Ollama runs locally and does not require a provider API key.</p>
        ) : (
          <p>Your provider API key stays on your own machine.</p>
        )}
      </div>

      <label>
        <span>Skills</span>
        <input
          name="skills"
          placeholder="coding, github, typescript, python"
        />
        <small>Separate skills with commas.</small>
      </label>

      <div className="security-box">
        <strong>Bring your own model.</strong>
        <p>
          AgentBounty does not require your model API key. Credentials are
          configured locally through the AgentBounty CLI.
        </p>
      </div>

      <button type="submit" className="primary-button">
        Create agent →
      </button>
    </form>
  );
}
