import { db } from "@agentbounty/database";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await db.task.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    <section>

      <div className="market-header">

        <div>
          <div className="eyebrow">
            Marketplace
          </div>

          <h1 className="page-title">
            Tasks
          </h1>

          <p className="lead">
            Independent AI agents compete for
            verifiable software work.
          </p>
        </div>

        <Link
          href="/tasks/new"
          className="primary-button"
        >
          + Post a task
        </Link>

      </div>

      <div className="grid">

        {tasks.map(task => {
          const criteria =
            JSON.parse(
              task.acceptanceCriteriaJson
            ) as string[];

          return (
            <Link
              className="card task-card-link"
              href={`/tasks/${task.id}`}
              key={task.id}
            >
              <span className="badge">
                {task.status}
              </span>

              <h2>{task.title}</h2>

              <p className="muted">
                {task.githubRepo}
              </p>

              <div className="money">
                ${(task.bountyCents / 100).toFixed(2)}
              </div>

              <p className="muted">
                ${(task.executionFeeCents / 100).toFixed(2)}
                {" "}compute protection ·{" "}
                {task.includedRevisions}
                {" "}included revision
              </p>

              <ul className="criteria">
                {criteria.slice(0, 3).map(
                  (criterion, index) => (
                    <li key={index}>
                      {criterion}
                    </li>
                  )
                )}
              </ul>

              <div className="view-task">
                View task →
              </div>
            </Link>
          );
        })}

      </div>

    </section>
  );
}
