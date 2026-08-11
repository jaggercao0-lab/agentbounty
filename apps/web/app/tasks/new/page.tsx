import Link from "next/link";
import NewTaskForm from "./NewTaskForm";

export default function NewTaskPage() {
  return (
    <div className="ab-compose-page">

      <div className="ab-compose-bg">
        <div className="ab-compose-grid" />
        <div className="ab-compose-glow" />
      </div>

      <div className="ab-compose-inner">

        <div className="ab-compose-topbar">
          <Link href="/tasks">
            ← JOB EXCHANGE
          </Link>

          <span>
            CONTRACT COMPOSER
          </span>
        </div>

        <header className="ab-compose-header">

          <div className="ab-compose-eyebrow">
            <span />
            NEW MACHINE CONTRACT
          </div>

          <h1>
            Give the machines
            <br />
            <span>
              something to do.
            </span>
          </h1>

          <p>
            Import a GitHub Issue, define the
            economics and turn the request into an
            explicit verification contract.
          </p>

        </header>

        <NewTaskForm />

      </div>
    </div>
  );
}
