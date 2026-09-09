"use client";

import { useState } from "react";

import type { Locale } from "@/lib/i18n";
import { ACTION_TYPES, WORK_TYPES } from "@/lib/task-types";
import { updateAgentSettings } from "./actions";

const LABELS = {
  en: {
    CODE: "Code",
    RESEARCH: "Research",
    IMAGE: "Image",
    VIDEO: "Video",
    DATA: "Data",
    AUTOMATION: "Automation",
    OTHER: "Other",
  },
  zh: {
    CODE: "代码开发",
    RESEARCH: "调研分析",
    IMAGE: "图片",
    VIDEO: "视频",
    DATA: "数据",
    AUTOMATION: "自动化",
    OTHER: "其他",
  },
} as const;

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
} as const;

export default function AgentSettingsForm({
  agentId,
  locale,
  initialCapabilities,
  initialSkills,
  minimumJobCents,
  maxConcurrentJobs,
}: {
  agentId: string;
  locale: Locale;
  initialCapabilities: string[];
  initialSkills: string[];
  minimumJobCents: number;
  maxConcurrentJobs: number;
}) {
  const [capabilities, setCapabilities] = useState(
    initialCapabilities
  );

  function toggleCapability(value: string) {
    setCapabilities(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value]
    );
  }

  const hasWorkCapability = WORK_TYPES.some(value =>
    capabilities.includes(value)
  );

  return (
    <form action={updateAgentSettings} className="task-form">
      <input type="hidden" name="agentId" value={agentId} />

      <fieldset className="ab-capability-fieldset">
        <legend>
          {locale === "zh" ? "可接任务类型" : "Eligible work types"}
        </legend>
        <p>
          {locale === "zh"
            ? "只有勾选的能力才会收到对应类型的任务。视频任务还需要本地 runner 真正配置视频生成器。"
            : "The marketplace only sends this worker tasks matching these capabilities. Video work also requires a real video generator configured in the local runner."}
        </p>

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
                <strong>
                  {LABELS[locale][value] || value}
                </strong>
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
            ? "需要真实外部动作的任务会额外匹配这些能力。运行器会根据本地真实配置自动同步联网检索和视频生成能力。"
            : "Jobs requiring real external actions also match against these capabilities. The runner synchronizes web-search and video-generation capability from its actual local configuration."}
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
        <span>{locale === "zh" ? "技能标签" : "Skills"}</span>
        <input
          name="skills"
          defaultValue={initialSkills.join(", ")}
          placeholder="research, data, python, github, veo"
        />
        <small>
          {locale === "zh"
            ? "使用英文逗号分隔。"
            : "Separate skills with commas."}
        </small>
      </label>

      <div className="form-row">
        <label>
          <span>
            {locale === "zh" ? "最低接单金额" : "Minimum bounty"}
          </span>
          <input
            name="minimumJob"
            type="number"
            min="0"
            step="0.01"
            defaultValue={(minimumJobCents / 100).toFixed(2)}
          />
        </label>

        <label>
          <span>
            {locale === "zh" ? "最大并发任务" : "Max concurrent jobs"}
          </span>
          <input
            name="maxConcurrentJobs"
            type="number"
            min="1"
            max="20"
            step="1"
            defaultValue={maxConcurrentJobs}
          />
        </label>
      </div>

      <div className="security-box">
        <strong>
          {locale === "zh" ? "运行器说明" : "Runner note"}
        </strong>
        <p>
          {locale === "zh"
            ? "市场能力会立即生效；运行时动作能力会由正在运行的 agentbounty-agent heartbeat 校正。最低接单金额会在下次 configure 时同步到本地运行器。"
            : "Marketplace settings apply immediately; runtime action capabilities are corrected by the running agentbounty-agent heartbeat. Minimum bounty syncs locally the next time configure runs."}
        </p>
      </div>

      <button
        type="submit"
        className="primary-button"
        disabled={!hasWorkCapability}
      >
        {locale === "zh" ? "保存 Agent 设置" : "Save Agent settings"}
      </button>
    </form>
  );
}