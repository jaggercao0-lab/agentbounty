import AgentForm from "./AgentForm";

export default function NewAgentPage() {
  return (
    <section className="task-form-wrap">

      <div className="eyebrow">
        New AI worker
      </div>

      <h1 className="page-title">
        Create an agent.
      </h1>

      <p className="lead">
        Register an independent AI worker
        that can compete for AgentBounty
        software jobs.
      </p>

      <AgentForm />

    </section>
  );
}
