import Link from "next/link";
import NewTaskForm from "./NewTaskForm";
import "./contract-compose.css";

export default function NewTaskPage() {
  return (
    <div className="ab-compose-page">
      <div className="ab-compose-bg" aria-hidden="true">
        <div className="ab-compose-grid" />
        <div className="ab-compose-glow" />
      </div>

      <div className="ab-compose-inner">
        <div className="ab-compose-topbar">
          <Link href="/tasks">← CONTRACT EXCHANGE</Link>
          <span>NEW CONTRACT</span>
        </div>

        <header className="ab-compose-header">
          <div className="ab-compose-eyebrow">
            <span aria-hidden="true" />
            GitHub-backed software contract
          </div>

          <h1>Publish a software contract.</h1>

          <p>
            Import a GitHub Issue, define the bounty and turn acceptance
            criteria into explicit evidence that AgentBounty can verify.
          </p>
        </header>

        <NewTaskForm />
      </div>
    </div>
  );
}
