"""Protocol 0.4 runner extensions for AgentBounty.

This module keeps the proven 0.3 coding runner intact and patches in
General Task Market discovery, bidding, and text/JSON execution.
"""

import json
import urllib.parse

from . import cli as legacy


PROTOCOL_QUERY = "protocol=0.4"


def get_open_tasks(config):
    result = legacy.api_request(
        config,
        f"/api/v1/tasks?{PROTOCOL_QUERY}"
    )

    if isinstance(result, list):
        return result

    if "tasks" in result:
        return result["tasks"]

    if "jobs" in result:
        return result["jobs"]

    return []


def get_jobs(config):
    result = legacy.api_request(
        config,
        (
            f"/api/v1/agents/{config['agent_id']}/jobs"
            f"?{PROTOCOL_QUERY}"
        )
    )

    return result.get("jobs", [])


def try_bid(config):
    tasks = get_open_tasks(config)

    suitable = [
        task
        for task in tasks
        if (
            task["bountyCents"]
            >= config["min_bounty_cents"]
            and
            task["bountyCents"]
            <= config["max_bounty_cents"]
        )
    ]

    suitable.sort(
        key=lambda task: task["bountyCents"],
        reverse=True
    )

    for task in suitable:
        result = legacy.api_request(
            config,
            f"/api/v1/tasks/{task['id']}/bids",
            method="POST",
            body={
                "agentId": config["agent_id"],
                "priceCents": task["bountyCents"],
                "message": (
                    "Autonomous AgentBounty worker. "
                    "Execution uses the Agent Owner's "
                    "own model and compute."
                )
            }
        )

        if result.get("alreadyExists"):
            continue

        print()
        print("💼 BID PLACED")
        print("Task:", task["title"])
        print(
            "Price:",
            f"${task['bountyCents'] / 100:.2f}"
        )
        print(
            "Type:",
            task.get("workType", "CODE")
        )

        # Place at most one new bid per polling cycle.
        return


def _general_task_prompt(context):
    task = context.get("task") or {}
    source = context.get("source") or {}

    return f"""
You are an autonomous worker completing a paid task through AgentBounty.

TASK:
{json.dumps(task, ensure_ascii=False, indent=2)}

SOURCE:
{json.dumps(source, ensure_ascii=False, indent=2)}

Complete the task exactly as requested and satisfy every acceptance criterion.

Rules:
- Return only the final deliverable, not planning notes or hidden reasoning.
- Be specific, useful, and self-contained.
- Do not claim to have used tools, sources, files, or live data that were not provided.
- If the task asks for analysis or research, structure the answer clearly and include caveats where information cannot be verified from the provided context.
- For TEXT delivery, use clean GitHub-flavored Markdown: headings, bullets, numbered lists, tables, links, bold text, and fenced code blocks are allowed.
- Never emit HTML layout tags such as <br>, <div>, <table>, or <p>; use Markdown syntax instead.
- Keep Markdown tables structurally valid: one header row, one separator row, then data rows with the same number of columns.
""".strip()


def execute_general_job(config, job):
    task_id = job["id"]
    agent_id = config["agent_id"]
    encoded_agent_id = urllib.parse.quote(agent_id)

    print()
    print("=" * 62)
    print("GENERAL WORK RECEIVED")
    print("Task:", job["title"])
    print("Task ID:", task_id)
    print("Type:", job.get("workType"))
    print("Delivery:", job.get("deliveryType"))
    print("=" * 62)

    context = legacy.api_request(
        config,
        (
            f"/api/v1/tasks/{task_id}/context"
            f"?agentId={encoded_agent_id}"
        )
    )

    print()
    print("[1] General task context received")

    delivery_type = (
        (context.get("submit") or {}).get("deliveryType")
        or (context.get("task") or {}).get("deliveryType")
        or job.get("deliveryType")
    )

    prompt = _general_task_prompt(context)

    if delivery_type == "TEXT":
        content = legacy.call_llm(
            config,
            [
                {
                    "role": "system",
                    "content": (
                        "You are a precise autonomous task worker. "
                        "Return only the final deliverable in clean Markdown."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        ).strip()

        if not content:
            raise RuntimeError(
                "AI returned empty text delivery."
            )

        submission_body = {
            "agentId": agent_id,
            "deliveryType": "TEXT",
            "textContent": content,
            "notes": "Completed by AgentBounty protocol 0.4 runner."
        }

    elif delivery_type == "JSON":
        response = legacy.call_llm(
            config,
            [
                {
                    "role": "system",
                    "content": (
                        "You are a precise autonomous task worker. "
                        "Return valid JSON only."
                    )
                },
                {
                    "role": "user",
                    "content": (
                        prompt
                        + "\n\nReturn the final deliverable as valid JSON only."
                    )
                }
            ]
        )

        parsed = legacy.parse_ai_json(response)

        submission_body = {
            "agentId": agent_id,
            "deliveryType": "JSON",
            "jsonContent": parsed,
            "notes": "Completed by AgentBounty protocol 0.4 runner."
        }

    else:
        raise RuntimeError(
            "General runner currently supports TEXT and JSON "
            f"delivery, not {delivery_type}."
        )

    print()
    print("[2] AI generated general-task delivery")

    submission = legacy.api_request(
        config,
        f"/api/v1/tasks/{task_id}/submissions",
        method="POST",
        body=submission_body
    )

    print()
    print("[3] DELIVERY COMPLETE")
    print("Submission:", submission.get("id"))
    print("Delivery:", delivery_type)


def execute_job(config, job):
    if (
        job.get("workType") == "CODE"
        and job.get("deliveryType") == "PULL_REQUEST"
    ):
        return legacy._execute_job_v03(config, job)

    return execute_general_job(config, job)


def _install_protocol_v04_patches():
    # Keep a stable reference to the original coding executor before
    # replacing the module-level name used by legacy.run().
    if not hasattr(legacy, "_execute_job_v03"):
        legacy._execute_job_v03 = legacy.execute_job

    legacy.get_open_tasks = get_open_tasks
    legacy.get_jobs = get_jobs
    legacy.try_bid = try_bid
    legacy.execute_job = execute_job


def main():
    _install_protocol_v04_patches()
    return legacy.main()


if __name__ == "__main__":
    main()
