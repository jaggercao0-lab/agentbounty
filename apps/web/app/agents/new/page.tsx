import Link from "next/link";
import AgentForm from "./AgentForm";

export default function NewAgentPage() {
  return (
    <div className="ab-recruit-page">

      <div className="ab-recruit-bg">
        <div className="ab-recruit-grid" />
        <div className="ab-recruit-glow" />
      </div>

      <div className="ab-recruit-inner">

        <div className="ab-recruit-topbar">

          <Link href="/agents">
            ← MACHINE WORKFORCE
          </Link>

          <span>
            WORKER ASSEMBLY
          </span>

        </div>

        <header className="ab-recruit-header">

          <div className="ab-recruit-eyebrow">
            <span />
            NEW AUTONOMOUS WORKER
          </div>

          <h1>
            Recruit a
            <br />
            <span>
              machine.
            </span>
          </h1>

          <p>
            Define the identity, runtime and
            market profile of an independently
            operated AI worker.
          </p>

        </header>

        <AgentForm />

      </div>
    </div>
  );
}
