"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";
import {
  WORK_TYPES,
  SOURCE_TYPES,
  DELIVERY_TYPES,
  VERIFICATION_TYPES,
  DEFAULT_DELIVERY_BY_WORK,
  DEFAULT_VERIFICATION_BY_WORK,
  type WorkType,
  type SourceType,
  type DeliveryType,
  type VerificationType,
} from "@/lib/task-types";

import {
  createTask,
  previewGitHubIssue,
} from "./actions";

function money(value: string) {
  const amount = Number(value || 0);
  return Number.isFinite(amount)
    ? `$${amount.toFixed(2)}`
    : "$0.00";
}

function optionClass(active: boolean) {
  return active
    ? "ab-compose-verifier-option ab-compose-verifier-enabled"
    : "ab-compose-verifier-option";
}

function automaticRule(
  deliveryType: DeliveryType,
  verificationType: VerificationType
) {
  if (deliveryType === "TEXT") {
    return "TEXT MIN LENGTH: 500";
  }

  if (deliveryType === "FILE") {
    return "FILE REQUIRED";
  }

  if (deliveryType === "URL") {
    return "URL REQUIRED";
  }

  if (deliveryType === "JSON") {
    return "JSON REQUIRED";
  }

  if (
    deliveryType === "PULL_REQUEST" &&
    verificationType === "HYBRID"
  ) {
    return "A pull request is submitted";
  }

  if (deliveryType === "PULL_REQUEST") {
    return "URL REQUIRED";
  }

  return "";
}

function manualRule(deliveryType: DeliveryType) {
  switch (deliveryType) {
    case "TEXT":
      return "Review the submitted text against the task requirements";
    case "FILE":
      return "Review the submitted file against the task requirements";
    case "URL":
      return "Review the submitted URL against the task requirements";
    case "JSON":
      return "Review the submitted JSON against the task requirements";
    case "PULL_REQUEST":
      return "Review the pull request against the task requirements";
    default:
      return "Review the delivery against the task requirements";
  }
}

function defaultCriteria(
  deliveryType: DeliveryType,
  verificationType: VerificationType
) {
  if (verificationType === "GITHUB") {
    return "A pull request is submitted";
  }

  if (verificationType === "MANUAL") {
    return manualRule(deliveryType);
  }

  const machineRule = automaticRule(
    deliveryType,
    verificationType
  );

  if (verificationType === "AUTOMATIC") {
    return machineRule || manualRule(deliveryType);
  }

  return [
    machineRule,
    manualRule(deliveryType),
  ]
    .filter(Boolean)
    .join("\n");
}

export default function NewTaskForm({
  locale,
}: {
  locale: Locale;
}) {
  const copy = extraTranslations[locale].newTask;

  const [workType, setWorkType] =
    useState<WorkType>("CODE");
  const [sourceType, setSourceType] =
    useState<SourceType>("MANUAL");
  const [deliveryType, setDeliveryType] =
    useState<DeliveryType>("PULL_REQUEST");
  const [verificationType, setVerificationType] =
    useState<VerificationType>("GITHUB");

  const [githubRepo, setGithubRepo] = useState("");
  const [githubIssueUrl, setGithubIssueUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] =
    useState("A pull request is submitted");
  const [bounty, setBounty] = useState("20");
  const [executionFee, setExecutionFee] = useState("4");
  const [includedRevisions, setIncludedRevisions] =
    useState("1");
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [isPending, startTransition] = useTransition();

  const criteria = useMemo(
    () =>
      acceptanceCriteria
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean),
    [acceptanceCriteria]
  );

  const successReward = Math.max(
    0,
    Number(bounty || 0) - Number(executionFee || 0)
  );

  const repoRequired =
    workType === "CODE" || deliveryType === "PULL_REQUEST";

  const verifierPresets = useMemo(() => {
    if (verificationType === "GITHUB") {
      return [
        {
          rule: "A pull request is submitted",
          label: copy.presetPullTitle,
          description: copy.presetPullBody,
        },
        {
          rule: "BUILD PASSES",
          label: copy.presetBuildTitle,
          description: copy.presetBuildBody,
        },
        {
          rule: "TESTS PASS",
          label: copy.presetTestsTitle,
          description: copy.presetTestsBody,
        },
        {
          rule: "LINT PASSES",
          label: copy.presetLintTitle,
          description: copy.presetLintBody,
        },
      ];
    }

    if (
      verificationType === "AUTOMATIC" ||
      verificationType === "HYBRID"
    ) {
      const presets: Array<{
        rule: string;
        label: string;
        description: string;
      }> = [];

      if (deliveryType === "TEXT") {
        presets.push({
          rule: "TEXT MIN LENGTH: 500",
          label:
            locale === "zh"
              ? "至少 500 字符"
              : "At least 500 characters",
          description:
            locale === "zh"
              ? "自动检查文字交付的最小长度。"
              : "Checks the minimum length of the text delivery.",
        });
      }

      if (deliveryType === "URL") {
        presets.push({
          rule: "URL REQUIRED",
          label:
            locale === "zh"
              ? "必须提供有效链接"
              : "Valid URL required",
          description:
            locale === "zh"
              ? "自动检查交付中是否包含 HTTPS 链接。"
              : "Requires an HTTPS result URL.",
        });
      }

      if (deliveryType === "FILE") {
        presets.push({
          rule: "FILE REQUIRED",
          label:
            locale === "zh"
              ? "必须提供文件"
              : "File required",
          description:
            locale === "zh"
              ? "自动检查是否提交了可下载的文件链接。"
              : "Requires a downloadable artifact URL.",
        });
      }

      if (deliveryType === "JSON") {
        presets.push({
          rule: "JSON REQUIRED",
          label:
            locale === "zh"
              ? "必须提供有效 JSON"
              : "Valid JSON required",
          description:
            locale === "zh"
              ? "自动解析并检查 JSON 交付。"
              : "Parses and validates the JSON delivery.",
        });
      }

      if (deliveryType === "PULL_REQUEST") {
        const rule =
          verificationType === "HYBRID"
            ? "A pull request is submitted"
            : "URL REQUIRED";

        presets.push({
          rule,
          label:
            locale === "zh"
              ? "必须提交 Pull Request"
              : "Pull Request required",
          description:
            verificationType === "HYBRID"
              ? locale === "zh"
                ? "先自动检查 GitHub 交付，再由发布者最终确认。"
                : "Checks the GitHub delivery before owner approval."
              : locale === "zh"
                ? "自动检查是否提交了有效的 PR 链接。"
                : "Requires a valid PR URL.",
        });
      }

      return presets;
    }

    return [];
  }, [copy, deliveryType, locale, verificationType]);

  function chooseWorkType(value: WorkType) {
    const nextDelivery = DEFAULT_DELIVERY_BY_WORK[value];
    const nextVerification = DEFAULT_VERIFICATION_BY_WORK[value];

    setWorkType(value);
    setDeliveryType(nextDelivery);
    setVerificationType(nextVerification);
    setAcceptanceCriteria(
      defaultCriteria(nextDelivery, nextVerification)
    );
  }

  function chooseSource(value: SourceType) {
    setSourceType(value);
    setImportError("");
    setImportMessage("");
  }

  function chooseDelivery(value: DeliveryType) {
    const nextVerification =
      value !== "PULL_REQUEST" && verificationType === "GITHUB"
        ? "MANUAL"
        : verificationType;

    setDeliveryType(value);
    setVerificationType(nextVerification);
    setAcceptanceCriteria(
      defaultCriteria(value, nextVerification)
    );
  }

  function chooseVerification(value: VerificationType) {
    if (
      value === "GITHUB" &&
      deliveryType !== "PULL_REQUEST"
    ) {
      return;
    }

    setVerificationType(value);
    setAcceptanceCriteria(
      defaultCriteria(deliveryType, value)
    );
  }

  function matchesPreset(line: string, rule: string) {
    if (rule === "A pull request is submitted") {
      return line
        .toLowerCase()
        .startsWith("a pull request is submitted");
    }
    return line === rule;
  }

  function setVerifierPreset(rule: string, enabled: boolean) {
    const lines = acceptanceCriteria
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const exists = lines.some(line =>
      matchesPreset(line, rule)
    );

    if (enabled && !exists) {
      setAcceptanceCriteria(
        [...lines, rule].join("\n")
      );
    } else if (!enabled && exists) {
      setAcceptanceCriteria(
        lines
          .filter(line => !matchesPreset(line, rule))
          .join("\n")
      );
    }
  }

  function importIssue() {
    setImportError("");
    setImportMessage("");

    if (!githubIssueUrl.trim()) {
      setImportError(copy.pasteIssue);
      return;
    }

    startTransition(async () => {
      const result = await previewGitHubIssue(
        githubIssueUrl
      );

      if (!result.ok) {
        setImportError(result.error);
        return;
      }

      setGithubRepo(result.repository.fullName);
      setTitle(result.issue.title);
      setDescription(
        result.issue.body || result.issue.title
      );

      if (
        deliveryType === "PULL_REQUEST" &&
        verificationType === "GITHUB"
      ) {
        setAcceptanceCriteria(
          result.suggestedAcceptanceCriteria.join("\n")
        );
      }

      setImportMessage(
        `${copy.imported} ${result.repository.fullName}#${result.issue.number}`
      );
    });
  }

  return (
    <form action={createTask} className="ab-compose-layout">
      <main className="ab-compose-main">
        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.workTypeLabel}</span>
              <h2>{copy.workTypeHeading}</h2>
            </div>
          </div>

          <div className="ab-compose-verifier-grid ab-general-choice-grid">
            {WORK_TYPES.map(value => {
              const [label, help] = copy.workTypes[value];
              const active = workType === value;

              return (
                <label key={value} className={optionClass(active)}>
                  <input
                    type="radio"
                    name="workType"
                    value={value}
                    checked={active}
                    onChange={() => chooseWorkType(value)}
                  />
                  <span className="ab-compose-verifier-toggle">
                    {active ? "✓" : ""}
                  </span>
                  <span className="ab-compose-verifier-copy">
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.source}</span>
              <h2>{copy.importWork}</h2>
            </div>
            <span className="ab-compose-step">{copy.required}</span>
          </div>

          <div className="ab-compose-verifier-grid ab-general-choice-grid">
            {SOURCE_TYPES.map(value => {
              const [label, help] = copy.sourceTypes[value];
              const active = sourceType === value;

              return (
                <label key={value} className={optionClass(active)}>
                  <input
                    type="radio"
                    name="sourceType"
                    value={value}
                    checked={active}
                    onChange={() => chooseSource(value)}
                  />
                  <span className="ab-compose-verifier-toggle">
                    {active ? "✓" : ""}
                  </span>
                  <span className="ab-compose-verifier-copy">
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </span>
                </label>
              );
            })}
          </div>

          {sourceType === "GITHUB_ISSUE" && (
            <label className="ab-compose-field">
              <span>{copy.issueUrl}</span>
              <div className="ab-compose-import">
                <input
                  name="githubIssueUrl"
                  type="url"
                  value={githubIssueUrl}
                  onChange={event =>
                    setGithubIssueUrl(event.target.value)
                  }
                  placeholder="https://github.com/owner/repo/issues/5"
                  required
                />
                <button
                  type="button"
                  onClick={importIssue}
                  disabled={isPending}
                >
                  {isPending
                    ? copy.importing
                    : copy.importIssue}
                  <span>↳</span>
                </button>
              </div>

              {importMessage && (
                <small className="ab-compose-success">
                  ✓ {importMessage}
                </small>
              )}
              {importError && (
                <small className="ab-compose-error">
                  {importError}
                </small>
              )}
            </label>
          )}

          {["URL", "FILE", "API"].includes(sourceType) && (
            <label className="ab-compose-field">
              <span>{copy.sourceUrl}</span>
              <input
                name="sourceUrl"
                type="url"
                value={sourceUrl}
                onChange={event =>
                  setSourceUrl(event.target.value)
                }
                placeholder="https://..."
                required
              />
              <small>{copy.sourceUrlHelp}</small>
            </label>
          )}

          {(repoRequired || githubRepo) && (
            <label className="ab-compose-field">
              <span>{copy.githubOptional}</span>
              <input
                name="githubRepo"
                value={githubRepo}
                onChange={event =>
                  setGithubRepo(event.target.value)
                }
                placeholder="owner/repository"
                required={repoRequired}
              />
              <small>
                {repoRequired
                  ? copy.repositoryRequiredCode
                  : copy.githubOptionalHelp}
              </small>
            </label>
          )}
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.deliveryLabel}</span>
              <h2>{copy.deliveryHeading}</h2>
            </div>
          </div>

          <div className="ab-compose-verifier-grid ab-general-choice-grid">
            {DELIVERY_TYPES.map(value => {
              const [label, help] = copy.deliveryTypes[value];
              const active = deliveryType === value;

              return (
                <label key={value} className={optionClass(active)}>
                  <input
                    type="radio"
                    name="deliveryType"
                    value={value}
                    checked={active}
                    onChange={() => chooseDelivery(value)}
                  />
                  <span className="ab-compose-verifier-toggle">
                    {active ? "✓" : ""}
                  </span>
                  <span className="ab-compose-verifier-copy">
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.verificationModeLabel}</span>
              <h2>{copy.verificationModeHeading}</h2>
            </div>
          </div>

          <div className="ab-compose-verifier-grid ab-general-choice-grid">
            {VERIFICATION_TYPES.map(value => {
              const [label, help] = copy.verificationTypes[value];
              const disabled =
                value === "GITHUB" &&
                deliveryType !== "PULL_REQUEST";
              const active = verificationType === value;

              return (
                <label
                  key={value}
                  className={
                    disabled
                      ? "ab-compose-verifier-option ab-general-option-disabled"
                      : optionClass(active)
                  }
                >
                  <input
                    type="radio"
                    name="verificationType"
                    value={value}
                    checked={active}
                    disabled={disabled}
                    onChange={() =>
                      chooseVerification(value)
                    }
                  />
                  <span className="ab-compose-verifier-toggle">
                    {active ? "✓" : ""}
                  </span>
                  <span className="ab-compose-verifier-copy">
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.scope}</span>
              <h2>{copy.contractDefinition}</h2>
            </div>
          </div>

          <label className="ab-compose-field">
            <span>{copy.taskTitle}</span>
            <input
              name="title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder={copy.directTitlePlaceholder}
              required
            />
          </label>

          <label className="ab-compose-field">
            <span>{copy.descriptionLabel}</span>
            <textarea
              name="description"
              rows={7}
              value={description}
              onChange={event =>
                setDescription(event.target.value)
              }
              placeholder={copy.descriptionPlaceholder}
              required
            />
          </label>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.economics}</span>
              <h2>{copy.contractEconomics}</h2>
            </div>
          </div>

          <div className="ab-compose-money-grid">
            <label className="ab-compose-field">
              <span>{copy.totalBounty}</span>
              <input
                name="bounty"
                type="number"
                step="0.01"
                min="1"
                value={bounty}
                onChange={event =>
                  setBounty(event.target.value)
                }
                required
              />
            </label>

            <label className="ab-compose-field">
              <span>{copy.computeProtection}</span>
              <input
                name="executionFee"
                type="number"
                step="0.01"
                min="0.01"
                value={executionFee}
                onChange={event =>
                  setExecutionFee(event.target.value)
                }
                required
              />
            </label>

            <label className="ab-compose-field">
              <span>{copy.includedRevisions}</span>
              <input
                name="includedRevisions"
                type="number"
                min="0"
                max="5"
                value={includedRevisions}
                onChange={event =>
                  setIncludedRevisions(event.target.value)
                }
                required
              />
            </label>
          </div>

          <div className="ab-compose-economics">
            <div>
              <span>{copy.totalContract}</span>
              <strong>{money(bounty)}</strong>
            </div>
            <i>−</i>
            <div>
              <span>{copy.protectedCompute}</span>
              <strong>{money(executionFee)}</strong>
            </div>
            <i>=</i>
            <div className="ab-compose-reward">
              <span>{copy.successReward}</span>
              <strong>${successReward.toFixed(2)}</strong>
            </div>
          </div>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.verification}</span>
              <h2>{copy.definitionDone}</h2>
            </div>
          </div>

          {verifierPresets.length > 0 && (
            <div className="ab-compose-verifier-presets">
              <div className="ab-compose-verifier-head">
                <div>
                  <span>{copy.verifierPresets}</span>
                  <strong>
                    {verificationType === "GITHUB"
                      ? copy.trustedEvidence
                      : copy.verificationTypes[verificationType][0]}
                  </strong>
                </div>
                <b>{copy.safeMode}</b>
              </div>

              <div className="ab-compose-verifier-grid">
                {verifierPresets.map(preset => {
                  const enabled = criteria.some(line =>
                    matchesPreset(line, preset.rule)
                  );

                  return (
                    <label
                      key={preset.rule}
                      className={optionClass(enabled)}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={event =>
                          setVerifierPreset(
                            preset.rule,
                            event.target.checked
                          )
                        }
                      />
                      <span className="ab-compose-verifier-toggle">
                        {enabled ? "✓" : ""}
                      </span>
                      <span className="ab-compose-verifier-copy">
                        <strong>{preset.label}</strong>
                        <small>{preset.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <p className="ab-compose-verifier-note">
            {verificationType === "GITHUB"
              ? copy.verifierNote
              : copy.genericVerifierNote}
          </p>

          <label className="ab-compose-field">
            <textarea
              name="acceptanceCriteria"
              rows={9}
              value={acceptanceCriteria}
              onChange={event =>
                setAcceptanceCriteria(event.target.value)
              }
              placeholder={copy.criteriaPlaceholder}
              required
            />
            <small>{copy.genericCriteriaHelp}</small>
          </label>

          {criteria.length > 0 && (
            <div className="ab-compose-criteria-preview">
              {criteria.map((criterion, index) => (
                <div key={index}>
                  <span>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{criterion}</p>
                  <b>{copy.rule}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <aside className="ab-compose-sidebar">
        <div className="ab-compose-preview">
          <div className="ab-compose-preview-head">
            <div>
              <span className="ab-compose-preview-dot" />
              {copy.preview}
            </div>
            <span>{copy.open}</span>
          </div>

          <div className="ab-compose-preview-job">
            <span>
              {copy.workTypes[workType][0]}
              {githubRepo ? ` · ${githubRepo}` : ""}
            </span>
            <h2>{title || copy.untitled}</h2>
            <p>{description || copy.previewDescription}</p>
          </div>

          <div className="ab-general-preview-meta">
            <div>
              <span>{copy.sourcePreview}</span>
              <strong>{copy.sourceTypes[sourceType][0]}</strong>
            </div>
            <div>
              <span>{copy.deliveryPreview}</span>
              <strong>{copy.deliveryTypes[deliveryType][0]}</strong>
            </div>
            <div>
              <span>{copy.verificationPreview}</span>
              <strong>{copy.verificationTypes[verificationType][0]}</strong>
            </div>
          </div>

          <div className="ab-compose-preview-money">
            <div>
              <span>{copy.bounty}</span>
              <strong>{money(bounty)}</strong>
            </div>
            <div>
              <span>{copy.success}</span>
              <strong>${successReward.toFixed(2)}</strong>
            </div>
          </div>

          <div className="ab-compose-preview-info">
            <div>
              <span>{copy.acceptanceRules}</span>
              <strong>{criteria.length}</strong>
            </div>
            <div>
              <span>{copy.revisionAllowance}</span>
              <strong>{includedRevisions}</strong>
            </div>
          </div>

          <div className="ab-compose-machine-note">
            <span>&gt;_</span>
            {copy.machineNote}
          </div>

          <button
            type="submit"
            className="ab-compose-publish"
          >
            {copy.broadcast}
            <span>→</span>
          </button>
        </div>
      </aside>
    </form>
  );
}
