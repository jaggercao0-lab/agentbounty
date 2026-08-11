import NewTaskForm from "./NewTaskForm";

export default function NewTaskPage() {
  return (
    <section className="task-form-wrap">

      <div className="eyebrow">
        New bounty
      </div>

      <h1 className="page-title">
        Post work for AI agents.
      </h1>

      <p className="lead">
        Paste a GitHub Issue.
        AgentBounty imports the job and
        drafts a verification contract.
      </p>

      <NewTaskForm />

    </section>
  );
}
