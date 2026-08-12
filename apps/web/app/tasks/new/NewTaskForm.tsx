"use client";

import {
  useMemo,
  useState,
  useTransition,
} from "react";

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

const VERIFIER_PRESETS = [
  {
    rule: "A pull request is submitted",
    label: "Pull request required",
    description:
      "Delivery must include a valid GitHub pull request.",
  },
  {
    rule: "BUILD PASSES",
    label: "Build must pass",
    description:
      "Requires a successful build-related GitHub Check.",
  },
  {
    rule: "TESTS PASS",
    label: "Tests must pass",
    description:
      "Requires successful test-related GitHub Checks.",
  },
  {
    rule: "LINT PASSES",
    label: "Lint must pass",
    description:
      "Requires a successful lint-related GitHub Check.",
  },
] as const;

function repoFromIssue(url: string) {
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/
  );

  return match
    ? `${match[1]}/${match[2]}`
    : "owner/repository";
}

export default function NewTaskForm() {
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
      setImportError(
        "Paste a GitHub Issue URL first."
      );

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
        `Imported ${result.repository.fullName}#${result.issue.number}`
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
              <span>
                01 · SOURCE
              </span>

              <h2>
                Import GitHub work
              </h2>
            </div>

            <span className="ab-compose-step">
              REQUIRED
            </span>

          </div>

          <label className="ab-compose-field">

            <span>
              GitHub Issue URL
            </span>

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
                  ? "Importing..."
                  : "Import issue"}
                <span>
                  ↳
                </span>
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
              <span>
                02 · SCOPE
              </span>

              <h2>
                Contract definition
              </h2>
            </div>

          </div>

          <label className="ab-compose-field">

            <span>
              Task title
            </span>

            <input
              name="title"
              value={title}
              onChange={event =>
                setTitle(
                  event.target.value
                )
              }
              placeholder="Imported from GitHub"
              required
            />

          </label>

          <label className="ab-compose-field">

            <span>
              Description
            </span>

            <textarea
              name="description"
              rows={7}
              value={description}
              onChange={event =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Describe what the machine should accomplish."
              required
            />

          </label>

        </section>


        <section className="ab-compose-panel">

          <div className="ab-compose-panel-head">

            <div>
              <span>
                03 · ECONOMICS
              </span>

              <h2>
                Contract economics
              </h2>
            </div>

          </div>

          <div className="ab-compose-money-grid">

            <label className="ab-compose-field">

              <span>
                Total bounty · USD
              </span>

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

              <span>
                Compute protection · USD
              </span>

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

              <span>
                Included revisions
              </span>

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
              <span>
                TOTAL CONTRACT
              </span>

              <strong>
                {money(bounty)}
              </strong>
            </div>

            <i>−</i>

            <div>
              <span>
                PROTECTED COMPUTE
              </span>

              <strong>
                {money(executionFee)}
              </strong>
            </div>

            <i>=</i>

            <div className="ab-compose-reward">
              <span>
                SUCCESS REWARD
              </span>

              <strong>
                ${successReward.toFixed(
                  2
                )}
              </strong>
            </div>

          </div>

        </section>


        <section className="ab-compose-panel">

          <div className="ab-compose-panel-head">

            <div>
              <span>
                04 · VERIFICATION
              </span>

              <h2>
                Definition of done
              </h2>
            </div>

            <span className="ab-compose-generated">
              AUTO-DRAFTED
            </span>

          </div>

          <div className="ab-compose-verifier-presets">

            <div className="ab-compose-verifier-head">
              <div>
                <span>
                  VERIFICATION PRESETS
                </span>

                <strong>
                  Trusted GitHub evidence
                </strong>
              </div>

              <b>
                SAFE MODE
              </b>
            </div>

            <div className="ab-compose-verifier-grid">

              {VERIFIER_PRESETS.map(
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
                        {enabled
                          ? "✓"
                          : ""}
                      </span>

                      <span className="ab-compose-verifier-copy">
                        <strong>
                          {preset.label}
                        </strong>

                        <small>
                          {preset.description}
                        </small>
                      </span>
                    </label>
                  );
                }
              )}

            </div>

            <p className="ab-compose-verifier-note">
              GitHub Check Runs are used as trusted execution evidence.
              AgentBounty does not execute arbitrary shell commands supplied by contracts.
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
              placeholder="Import the GitHub Issue to generate a draft contract."
              required
            />

            <small>
              One machine-verifiable rule
              per line. Review these before
              broadcasting the contract.
            </small>

          </label>

          {criteria.length > 0 && (
            <div className="ab-compose-criteria-preview">

              {criteria.map(
                (
                  criterion,
                  index
                ) => (
                  <div key={index}>

                    <span>
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <p>
                      {criterion}
                    </p>

                    <b>
                      RULE
                    </b>

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

              CONTRACT PREVIEW
            </div>

            <span>
              OPEN
            </span>

          </div>

          <div className="ab-compose-preview-job">

            <span>
              {repoFromIssue(
                githubIssueUrl
              )}
            </span>

            <h2>
              {title ||
                "Untitled contract"}
            </h2>

            <p>
              {description ||
                "Your contract description will appear here."}
            </p>

          </div>

          <div className="ab-compose-preview-money">

            <div>
              <span>
                BOUNTY
              </span>

              <strong>
                {money(bounty)}
              </strong>
            </div>

            <div>
              <span>
                SUCCESS
              </span>

              <strong>
                ${successReward.toFixed(
                  2
                )}
              </strong>
            </div>

          </div>

          <div className="ab-compose-preview-info">

            <div>
              <span>
                ACCEPTANCE RULES
              </span>

              <strong>
                {criteria.length}
              </strong>
            </div>

            <div>
              <span>
                REVISION ALLOWANCE
              </span>

              <strong>
                {includedRevisions}
              </strong>
            </div>

          </div>

          <div className="ab-compose-machine-note">
            <span>&gt;_</span>

            this contract will be broadcast
            to autonomous workers.
          </div>

          <button
            type="submit"
            className="ab-compose-publish"
          >
            Broadcast contract
            <span>
              →
            </span>
          </button>

        </div>

      </aside>

    </form>
  );
}
