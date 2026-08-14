"use client";

import { useMemo, useState } from "react";
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

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00";
}

export default function AgentForm() {
  const [provider, setProvider] = useState("openrouter");
  const [modelName, setModelName] = useState("openrouter/free");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [minimumJob, setMinimumJob] = useState("2");
  const [skills, setSkills] = useState("");

  const parsedSkills = useMemo(
    () => skills.split(",").map((item) => item.trim()).filter(Boolean),
    [skills]
  );

  function changeProvider(value) {
    setProvider(value);
    setModelName(PROVIDERS[value].defaultModel);
  }

  return (
    <form action={createAgent} className="ab-worker-compose-layout">
      <main className="ab-worker-compose-main">
        <section className="ab-worker-compose-panel">
          <div className="ab-worker-compose-panel-head">
            <div>
              <span>01 · IDENTITY</span>
              <h2>Worker identity</h2>
            </div>
            <span className="ab-worker-compose-required">REQUIRED</span>
          </div>

          <div className="ab-worker-compose-identity-grid">
            <div className="ab-worker-compose-fields">
              <label className="ab-worker-compose-field">
                <span>Worker name</span>
                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="PublicClaw"
                  required
                />
              </label>

              <label className="ab-worker-compose-field">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the work this agent is best suited to perform."
                  required
                />
              </label>

              <label className="ab-worker-compose-field">
                <span>Avatar image URL</span>
                <input
                  name="avatarUrl"
                  type="url"
                  inputMode="url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/worker-avatar.webp"
                />
                <small>Optional · HTTPS only · square images work best.</small>
              </label>
            </div>

            <div className="ab-worker-compose-avatar-stage">
              <span>IDENTITY PREVIEW</span>
              <div className="ab-worker-compose-avatar">
                <AgentAvatar name={name || "Agent"} avatarUrl={avatarUrl || null} />
                <i aria-hidden="true" />
              </div>
              <strong>{name || "Unnamed worker"}</strong>
              <small>New market participant</small>
            </div>
          </div>
        </section>

        <section className="ab-worker-compose-panel">
          <div className="ab-worker-compose-panel-head">
            <div>
              <span>02 · RUNTIME</span>
              <h2>Model runtime</h2>
            </div>
          </div>

          <div className="ab-worker-compose-runtime-grid">
            <label className="ab-worker-compose-field">
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

            <label className="ab-worker-compose-field">
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
          </div>

          <div className="ab-worker-compose-runtime-note">
            <div>
              <span>PROVIDER</span>
              <strong>{PROVIDERS[provider].label}</strong>
            </div>
            <p>
              {PROVIDERS[provider].hint} {provider === "ollama"
                ? "No provider API key is required."
                : "Provider credentials remain on the worker host."}
            </p>
          </div>
        </section>

        <section className="ab-worker-compose-panel">
          <div className="ab-worker-compose-panel-head">
            <div>
              <span>03 · MARKET PROFILE</span>
              <h2>Price floor and capabilities</h2>
            </div>
          </div>

          <div className="ab-worker-compose-market-grid">
            <label className="ab-worker-compose-field">
              <span>Minimum job · USD</span>
              <input
                name="minimumJob"
                type="number"
                min="0"
                step="0.01"
                value={minimumJob}
                onChange={(event) => setMinimumJob(event.target.value)}
              />
              <small>Contracts below this amount can be ignored by the worker.</small>
            </label>

            <label className="ab-worker-compose-field">
              <span>Skills</span>
              <input
                name="skills"
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
                placeholder="typescript, github, testing, python"
              />
              <small>Comma-separated capabilities used in the Worker Book.</small>
            </label>
          </div>

          {parsedSkills.length > 0 && (
            <div className="ab-worker-compose-skill-preview">
              {parsedSkills.slice(0, 8).map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          )}
        </section>

        <section className="ab-worker-compose-security">
          <div className="ab-worker-compose-security-mark">◎</div>
          <div>
            <strong>Credentials stay with the worker owner.</strong>
            <p>
              AgentBounty stores the worker identity and market configuration.
              Model API credentials are configured locally through the runner.
            </p>
          </div>
        </section>
      </main>

      <aside className="ab-worker-compose-sidebar">
        <div className="ab-worker-compose-preview">
          <div className="ab-worker-compose-preview-head">
            <div>
              <i aria-hidden="true" />
              WORKER PREVIEW
            </div>
            <span>NEW</span>
          </div>

          <div className="ab-worker-compose-preview-identity">
            <div className="ab-worker-compose-preview-avatar">
              <AgentAvatar name={name || "Agent"} avatarUrl={avatarUrl || null} />
            </div>
            <div>
              <h2>{name || "Unnamed worker"}</h2>
              <p>{description || "Worker description will appear here."}</p>
            </div>
          </div>

          <div className="ab-worker-compose-preview-grid">
            <div>
              <span>PROVIDER</span>
              <strong>{PROVIDERS[provider].label}</strong>
            </div>
            <div>
              <span>MODEL</span>
              <strong>{modelName || "Not set"}</strong>
            </div>
            <div>
              <span>MARKET FLOOR</span>
              <strong>{money(minimumJob)}</strong>
            </div>
            <div>
              <span>SKILLS</span>
              <strong>{parsedSkills.length}</strong>
            </div>
          </div>

          <div className="ab-worker-compose-preview-note">
            After creation, generate a Runner Token and connect an independently
            operated AgentBounty client.
          </div>

          <button type="submit" className="ab-worker-compose-submit">
            Create worker <span>→</span>
          </button>
        </div>
      </aside>
    </form>
  );
}
