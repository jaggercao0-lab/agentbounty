"use client";

import { useEffect, useState } from "react";

import type { Locale } from "@/lib/i18n";
import type { SourceType, WorkType } from "@/lib/task-types";

export default function TaskActionSelector({
  locale,
  workType,
  sourceType,
}: {
  locale: Locale;
  workType: WorkType;
  sourceType: SourceType;
}) {
  const [webSearch, setWebSearch] = useState(false);
  const sourceFetchRequired = ["URL", "FILE", "API"].includes(sourceType);

  useEffect(() => {
    if (workType !== "RESEARCH") {
      setWebSearch(false);
    }
  }, [workType]);

  return (
    <section className="ab-compose-panel">
      <div className="ab-compose-panel-head">
        <div>
          <span>{locale === "zh" ? "AGENT 动作" : "AGENT ACTIONS"}</span>
          <h2>
            {locale === "zh"
              ? "这个任务需要 Agent 真正做什么？"
              : "What should the agent actually do?"}
          </h2>
        </div>
      </div>

      <p className="ab-compose-verifier-note">
        {locale === "zh"
          ? "动作能力会参与 Agent 匹配。要求了某个动作，就只有具备对应能力的 Agent 能看到并竞标。"
          : "Action capabilities participate in agent matching. Requiring an action limits discovery and bidding to agents that advertise that capability."}
      </p>

      <div className="ab-compose-verifier-grid ab-general-choice-grid">
        <label
          className={
            webSearch
              ? "ab-compose-verifier-option ab-compose-verifier-enabled"
              : workType !== "RESEARCH"
                ? "ab-compose-verifier-option ab-general-option-disabled"
                : "ab-compose-verifier-option"
          }
        >
          <input
            type="checkbox"
            name="requestedActions"
            value="WEB_SEARCH"
            checked={webSearch}
            disabled={workType !== "RESEARCH"}
            onChange={event => setWebSearch(event.target.checked)}
          />
          <span className="ab-compose-verifier-toggle">
            {webSearch ? "✓" : "⌕"}
          </span>
          <span className="ab-compose-verifier-copy">
            <strong>
              {locale === "zh" ? "联网检索" : "Web search"}
            </strong>
            <small>
              {workType === "RESEARCH"
                ? locale === "zh"
                  ? "要求 Agent 使用实时网页证据；没有搜到真实来源就不能交付。"
                  : "Require live web evidence. The runner cannot submit if no real sources are collected."
                : locale === "zh"
                  ? "当前只对调研任务开放。"
                  : "Currently available for research tasks only."}
            </small>
          </span>
        </label>

        <div
          className={
            sourceFetchRequired
              ? "ab-compose-verifier-option ab-compose-verifier-enabled"
              : "ab-compose-verifier-option ab-general-option-disabled"
          }
        >
          <span className="ab-compose-verifier-toggle">
            {sourceFetchRequired ? "✓" : "↗"}
          </span>
          <span className="ab-compose-verifier-copy">
            <strong>
              {locale === "zh" ? "读取外部来源" : "Fetch external source"}
            </strong>
            <small>
              {sourceFetchRequired
                ? locale === "zh"
                  ? "因为你选择了 URL / 文件 / API 来源，此动作已自动要求；读取失败就不能交付。"
                  : "Automatically required by URL / file / API sources. A failed fetch blocks delivery."
                : locale === "zh"
                  ? "选择 URL、文件或 API 来源后自动启用。"
                  : "Automatically enabled when the source is URL, file or API."}
            </small>
          </span>
        </div>
      </div>
    </section>
  );
}
