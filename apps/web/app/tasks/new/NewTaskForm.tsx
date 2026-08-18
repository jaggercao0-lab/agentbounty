"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

import type { Locale } from "@/lib/i18n";
import { extraTranslations } from "@/lib/i18n-extra";

import {
  createTask,
  previewGitHubIssue,
} from "./actions";

function money(value: string) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toFixed(2)}`;
}

function repoFromIssue(url: string) {
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/
  );

  return match
    ? `${match[1]}/${match[2]}`
    : "owner/repository";
}

export default function NewTaskForm({
  locale,
}: {
  locale: Locale;
}) {
  const copy = extraTranslations[locale].newTask;

  const verifierPresets = [
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
  ] as const;

  const [githubIssueUrl, setGithubIssueUrl] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [
    acceptanceCriteria,
    setAcceptanceCriteria,
  ] = useState("");

  const [bounty, setBounty] =
    useState("20");

  const [executionFee, setExecutionFee] =
    useState("4");

  const [
    includedRevisions,
    setIncludedRevisions,
  ] = useState("1");

  const [importMessage, setImportMessage] =
    useState("");

  const [importError, setImportError] =
    useState("");

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const criteria =
    useMemo(
      () =>
        acceptanceCriteria
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean),
      [acceptanceCriteria]
    );

  const successReward =
    Math.max(
      0,
      Number(bounty || 0) -
        Number(executionFee || 0)
    );

  function matchesVerifierPreset(
    line: string,
    rule: string
  ) {
    if (
      rule ===
      "A pull request is submitted"
    ) {
      return line
        .toLowerCase()
        .startsWith(
          "a pull request is submitted"
        );
    }

    return line === rule;
  }

  function isVerifierPresetEnabled(
    rule: string
  ) {
    return criteria.some(
      line =>
        matchesVerifierPreset(
          line,
          rule
        )
    );
  }

  function setVerifierPreset(
    rule: string,
    enabled: boolean
  ) {
    const lines =
      acceptanceCriteria
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const exists =
      lines.some(
        line =>
          matchesVerifierPreset(
            line,
            rule
          )
      );

    if (enabled && !exists) {
      setAcceptanceCriteria(
        [...lines, rule].join("\n")
      );
      return;
    }

    if (!enabled && exists) {
      setAcceptanceCriteria(
        lines
          .filter(
            line =>
              !matchesVerifierPreset(
                line,
                rule
              )
          )
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
      const result =
        await previewGitHubIssue(
          githubIssueUrl
        );

      if (!result.ok) {
        setImportError(result.error);
        return;
      }

      setTitle(
        result.issue.title
      );

      setDescription(
        result.issue.body ||
          result.issue.title
      );

      setAcceptanceCriteria(
        result.suggestedAcceptanceCriteria.join(
          "\n"
        )
      );

      setImportMessage(
        `${copy.imported} ${result.repository.fullName}#${result.issue.number}`
      );
    });
  }

  return (
    <form
      action={createTask}
      className="ab-compose-layout"
    >
      <main className="ab-compose-main">
        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.source}</span>
              <h2>{copy.importWork}</h2>
            </div>

            <span className="ab-compose-step">
              {copy.required}
            </span>
          </div>

          <label className="ab-compose-field">
            <span>{copy.issueUrl}</span>

            <div className="ab-compose-import">
              <input
                name="githubIssueUrl"
                type="url"
                value={githubIssueUrl}
                onChange={event =>
                  setGithubIssueUrl(
                    event.target.value
                  )
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
              onChange={event =>
                setTitle(
                  event.target.value
                )
              }
              placeholder={copy.titlePlaceholder}
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
                setDescription(
                  event.target.value
                )
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
                  setBounty(
                    event.target.value
                  )
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
                  setExecutionFee(
                    event.target.value
                  )
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
                  setIncludedRevisions(
                    event.target.value
                  )
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
              <strong>
                ${successReward.toFixed(2)}
              </strong>
            </div>
          </div>
        </section>

        <section className="ab-compose-panel">
          <div className="ab-compose-panel-head">
            <div>
              <span>{copy.verification}</span>
              <h2>{copy.definitionDone}</h2>
            </div>

            <span className="ab-compose-generated">
              {copy.autoDrafted}
            </span>
          </div>

          <div className="ab-compose-verifier-presets">
            <div className="ab-compose-verifier-head">
              <div>
                <span>{copy.verifierPresets}</span>
                <strong>{copy.trustedEvidence}</strong>
              </div>

              <b>{copy.safeMode}</b>
            </div>

            <div className="ab-compose-verifier-grid">
              {verifierPresets.map(
                preset => {
                  const enabled =
                    isVerifierPresetEnabled(
                      preset.rule
                    );

                  return (
                    <label
                      key={preset.rule}
                      className={
                        enabled
                          ? "ab-compose-verifier-option ab-compose-verifier-enabled"
                          : "ab-compose-verifier-option"
                      }
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
                }
              )}
            </div>

            <p className="ab-compose-verifier-note">
              {copy.verifierNote}
            </p>
          </div>

          <label className="ab-compose-field">
            <textarea
              name="acceptanceCriteria"
              rows={9}
              value={acceptanceCriteria}
              onChange={event =>
                setAcceptanceCriteria(
                  event.target.value
                )
              }
              placeholder={copy.criteriaPlaceholder}
              required
            />

            <small>{copy.criteriaHelp}</small>
          </label>

          {criteria.length > 0 && (
            <div className="ab-compose-criteria-preview">
              {criteria.map(
                (criterion, index) => (
                  <div key={index}>
                    <span>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p>{criterion}</p>
                    <b>{copy.rule}</b>
                  </div>
                )
              )}
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
            <span>{repoFromIssue(githubIssueUrl)}</span>
            <h2>{title || copy.untitled}</h2>
            <p>{description || copy.previewDescription}</p>
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
