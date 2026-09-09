"use client";

import { useState } from "react";
import { createAgent } from "./actions";
import { extraTranslations } from "@/lib/i18n-extra";
import { ACTION_TYPES, WORK_TYPES } from "@/lib/task-types";

const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    defaultModel: "openrouter/free",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "",
  },
  anthropic: {
    label: "Anthropic",
    defaultModel: "",
  },
  ollama: {
    label: "Ollama",
    defaultModel: "",
  },
  custom: {
    label: "Custom",
    defaultModel: "",
  },
};

const ACTION_LABELS = {
  en: {
    WEB_SEARCH: "Web search",
    SOURCE_FETCH: "Fetch external sources",
    VIDEO_GENERATE: "Generate video",
  },
  zh: {
    WEB_SEARCH: "联网检索",
    SOURCE_FETCH: "读取外部来源",
    VIDEO_GENERATE: "生成视频",
  },
};

export default function AgentForm({ locale }) {
  const copy = extraTranslations[locale].newAgent;

  const [provider, setProvider] = useState("openrouter");
  const [modelName, setModelName] = useState("openrouter/free");
  const [capabilities, setCapabilities] = useState(["CODE"]);

  function changeProvider(value) {
    setProvider(value);
    setModelName(PROVIDERS[value].defaultModel);
  }

  function toggleCapability(value) {
    setCapabilities(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  }

  const modelPlaceholder =
    provider === "ollama"
      ? "qwen3-coder"
      : provider === "anthropic"
        ? copy.claudeModel
        : provider === "openai"
          ? copy.openAIModel
          : copy.modelPlaceholder;

  return (
    <form action={createAgent} className="task-form">
      <label>
        <span>{copy.agentName}</span>
        <input
          name="name"
          placeholder="JaggerClaw"
          required
        />
      </label>

      <label>
        <span>{copy.descriptionLabel}</span>
        <textarea
          name="description"
          rows={4}
          placeholder="Autonomous coding, research or media agent..."
          required
        />
      </label>

      <div className="form-row">
        <label>
          <span>{copy.provider}</span>
          <select
            name="provider"
            value={provider}
            onChange={event => changeProvider(event.target.value)}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <label>
          <span>{copy.model}</span>
          <input
            name="modelName"
            value={modelName}
            onChange={event => setModelName(event.target.value)}
            placeholder={modelPlaceholder}
            required
          />
        </label>

        <label>
          <span>{copy.minJob}</span>
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
        <p>{copy.providerHints[provider]}</p>
        {provider === "ollama" ? (
          <p>{copy.ollamaLocal}</p>
        ) : (
          <p>{copy.providerKeyLocal}</p>
        )}
      </div>

      <fieldset className="ab-capability-fieldset">
        <legend>{copy.capabilities}</legend>
        <p>{copy.capabilitiesHelp}</p>

        <div className="ab-capability-grid">
          {WORK_TYPES.map(value => {
            const selected = capabilities.includes(value);

            return (
              <label
                key={value}
                className={
                  selected
                    ? "ab-capability-option ab-capability-option-active"
                    : "ab-capability-option"
                }
              >
                <input
                  type="checkbox"
                  name="capabilities"
                  value={value}
                  checked={selected}
                  onChange={() => toggleCapability(value)}
                />
                <span>{selected ? "✓" : "+"}</span>
                <strong>{copy.capabilityLabels[value]}</strong>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="ab-capability-fieldset">
        <legend>
          {locale === "zh" ? "可执行动作" : "Action capabilities"}
        </legend>
        <p>
          {locale === "zh"
            ? "这些能力决定 Agent 是否能接需要真实外部动作的任务。运行器会根据本地真实配置自动同步联网检索和视频生成能力。"
            : "These capabilities control whether this agent can receive jobs requiring real external actions. The runner synchronizes web-search and video-generation capability from its actual local configuration."}
        </p>

        <div className="ab-capability-grid">
          {ACTION_TYPES.map(value => {
            const selected = capabilities.includes(value);

            return (
              <label
                key={value}
                className={
                  selected
                    ? "ab-capability-option ab-capability-option-active"
                    : "ab-capability-option"
                }
              >
                <input
                  type="checkbox"
                  name="capabilities"
                  value={value}
                  checked={selected}
                  onChange={() => toggleCapability(value)}
                />
                <span>{selected ? "✓" : "+"}</span>
                <strong>{ACTION_LABELS[locale][value]}</strong>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label>
        <span>{copy.skills}</span>
        <input
          name="skills"
          placeholder="github, typescript, python, veo, research"
        />
        <small>{copy.skillsHelp}</small>
      </label>

      <div className="security-box">
        <strong>{copy.bringModel}</strong>
        <p>{copy.securityBody}</p>
      </div>

      <button type="submit" className="primary-button">
        {copy.create}
      </button>
    </form>
  );
}