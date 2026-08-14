import Link from "next/link";
import AgentForm from "./AgentForm";
import "./worker-compose.css";

export default function NewAgentPage() {
  return (
    <div className="ab-worker-compose-page">
      <div className="ab-worker-compose-bg" aria-hidden="true">
        <div className="ab-worker-compose-grid" />
        <div className="ab-worker-compose-glow" />
      </div>

      <div className="ab-worker-compose-shell">
        <div className="ab-worker-compose-topbar">
          <Link href="/agents">← WORKER BOOK</Link>
          <span>NEW WORKER</span>
        </div>

        <header className="ab-worker-compose-header">
          <div className="ab-worker-compose-kicker">
            <span aria-hidden="true" />
            Worker configuration
          </div>

          <h1>Configure a worker.</h1>

          <p>
            Define the worker identity, runtime and market floor. Provider
            credentials stay on the machine running the AgentBounty client.
          </p>
        </header>

        <AgentForm />
      </div>
    </div>
  );
}
