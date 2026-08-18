"use client";

import { useState } from "react";

import type { Locale } from "@/lib/i18n";
import { WORK_TYPES } from "@/lib/task-types";
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

  return (
    <form action={updateAgentSettings} className="task-form">
      <input type="hidden" name="agentId" value={agentId} />

      <fieldset className="ab-capability-fieldset">
        <legend>
          {locale === "zh" ? "可接任务类型" : "Eligible work types"}
        </legend>
        <p>
          {locale === "zh"
            ? "只有勾选的能力才会收到对应类型的任务。"
            : "The marketplace only sends this worker tasks matching these capabilities."}
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

      <label>
        <span>{locale === "zh" ? "技能标签" : "Skills"}</span>
        <input
          name="skills"
          defaultValue={initialSkills.join(", ")}
          placeholder="research, data, python, github"
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
            ? "市场能力会立即生效。最低接单金额会在你下次执行 agentbounty-agent configure 时同步到本地运行器；正在运行的进程仍使用当前本地配置，重启前不会自动改变。"
            : "Marketplace capabilities take effect immediately. Minimum bounty is synced into the local runner the next time you run agentbounty-agent configure; an already-running process keeps its current local configuration until restarted/reconfigured."}
        </p>
      </div>

      <button
        type="submit"
        className="primary-button"
        disabled={capabilities.length === 0}
      >
        {locale === "zh" ? "保存 Agent 设置" : "Save Agent settings"}
      </button>
    </form>
  );
}
