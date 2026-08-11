"use client";

import {
  useState,
  useTransition
} from "react";

import {
  createTask,
  previewGitHubIssue
} from "./actions";

export default function NewTaskForm() {
  const [githubIssueUrl, setGithubIssueUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [isPending, startTransition] = useTransition();

  function importIssue() {
    setImportError("");
    setImportMessage("");

    if (!githubIssueUrl.trim()) {
      setImportError("Paste a GitHub Issue URL first.");
      return;
    }

    startTransition(async () => {
      const result = await previewGitHubIssue(githubIssueUrl);

      if (!result.ok) {
        setImportError(result.error);
        return;
      }

      setTitle(result.issue.title);

      setDescription(
        result.issue.body || result.issue.title
      );

      setAcceptanceCriteria(
        result.suggestedAcceptanceCriteria.join("\n")
      );

      setImportMessage(
        `Imported ${result.repository.fullName}#${result.issue.number}`
      );
    });
  }

  return (
    <form action={createTask} className="task-form">

      <label>
        <span>GitHub Issue URL</span>

        <div className="issue-import-row">
          <input
            name="githubIssueUrl"
            type="url"
            value={githubIssueUrl}
            onChange={(event) =>
              setGithubIssueUrl(event.target.value)
            }
            placeholder="https://github.com/owner/repo/issues/5"
            required
          />

          <button
            type="button"
            className="secondary-button"
            onClick={importIssue}
            disabled={isPending}
          >
            {isPending ? "Importing..." : "Import from GitHub"}
          </button>
        </div>

        {importMessage && (
          <small className="success-text">
            ✓ {importMessage}
          </small>
        )}

        {importError && (
          <small className="error-text">
            {importError}
          </small>
        )}
      </label>

      <label>
        <span>Task title</span>

        <input
          name="title"
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          placeholder="Imported from GitHub"
          required
        />
      </label>

      <label>
        <span>Description</span>

        <textarea
          name="description"
          rows={7}
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          placeholder="Imported from GitHub Issue"
          required
        />
      </label>

      <div className="form-row">
        <label>
          <span>Total bounty (USD)</span>
          <input
            name="bounty"
            type="number"
            step="0.01"
            min="1"
            defaultValue="20"
            required
          />
        </label>

        <label>
          <span>Compute protection (USD)</span>
          <input
            name="executionFee"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue="4"
            required
          />
        </label>

        <label>
          <span>Included revisions</span>
          <input
            name="includedRevisions"
            type="number"
            min="0"
            max="5"
            defaultValue="1"
            required
          />
        </label>
      </div>

      <label>
        <div className="criteria-label-row">
          <span>Acceptance criteria</span>
          <span className="generated-pill">
            Auto-drafted
          </span>
        </div>

        <textarea
          name="acceptanceCriteria"
          rows={9}
          value={acceptanceCriteria}
          onChange={(event) =>
            setAcceptanceCriteria(event.target.value)
          }
          placeholder="Import the GitHub Issue to generate a draft contract."
          required
        />

        <small>
          Review this before publishing. One machine-verifiable rule per line.
        </small>
      </label>

      <button
        className="primary-button"
        type="submit"
      >
        Publish bounty →
      </button>

    </form>
  );
}
