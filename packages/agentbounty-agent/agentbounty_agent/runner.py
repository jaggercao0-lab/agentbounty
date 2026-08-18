"""Bundled AgentBounty reference runner.

The marketplace protocol is 0.4. This module adds implementation-specific
execution gating so the bundled worker only bids on task/delivery combinations
it can actually finish, while protocol details live in cli_v04.
"""

import getpass
import os
import sys

from . import __version__
from . import cli as legacy
from . import cli_v04 as v04


SUPPORTED_GENERAL_DELIVERIES = {
    "TEXT",
    "JSON",
}


def can_execute_task(task):
    work_type = str(task.get("workType") or "CODE").upper()
    delivery_type = str(
        task.get("deliveryType") or "PULL_REQUEST"
    ).upper()

    if work_type == "CODE" and delivery_type == "PULL_REQUEST":
        return True

    return delivery_type in SUPPORTED_GENERAL_DELIVERIES


def try_bid(config):
    tasks = v04.get_open_tasks(config)

    suitable = [
        task
        for task in tasks
        if (
            task["bountyCents"] >= config["min_bounty_cents"]
            and task["bountyCents"] <= config["max_bounty_cents"]
            and can_execute_task(task)
        )
    ]

    suitable.sort(
        key=lambda task: task["bountyCents"],
        reverse=True,
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
                ),
            },
        )

        if result.get("alreadyExists"):
            continue

        print()
        print("💼 BID PLACED")
        print("Task:", task["title"])
        print(
            "Price:",
            f"${task['bountyCents'] / 100:.2f}",
        )
        print("Type:", task.get("workType", "CODE"))
        print("Delivery:", task.get("deliveryType", "PULL_REQUEST"))

        # At most one new bid per polling cycle.
        return


def execute_job(config, job):
    if (
        job.get("workType") == "CODE"
        and job.get("deliveryType") == "PULL_REQUEST"
    ):
        return legacy._execute_job_v03(config, job)

    if not can_execute_task(job):
        raise RuntimeError(
            "Bundled AgentBounty runner cannot execute "
            f"{job.get('workType')} + {job.get('deliveryType')}."
        )

    return v04.execute_general_job(config, job)


def configure_search():
    config = legacy.load_config()
    existing = str(config.get("search_api_key") or "").strip()

    print()
    print("AgentBounty Research Search Setup")
    print("=================================")
    print()
    print(
        "Configure a local Tavily API key for web-grounded "
        "RESEARCH tasks. The key stays in ~/.agentbounty/config.json "
        "and is never sent to the marketplace."
    )
    print()

    prompt = (
        "Tavily API Key [Enter to keep existing]: "
        if existing
        else "Tavily API Key: "
    )
    entered = getpass.getpass(prompt).strip()
    api_key = entered or existing

    if not api_key:
        raise RuntimeError("Tavily API Key is required.")

    config["search_provider"] = "tavily"
    config["search_api_key"] = api_key
    legacy.save_config(config)

    print()
    print("✓ Web-grounded Research enabled locally.")
    print("  Search provider: tavily")
    print("  Key: stored locally (not displayed)")
    print()


def _apply_local_runtime_secrets(config):
    search_key = str(config.get("search_api_key") or "").strip()

    # Explicit environment variables take precedence for ephemeral/CI usage.
    if search_key and not os.environ.get("TAVILY_API_KEY"):
        os.environ["TAVILY_API_KEY"] = search_key


def _install_reference_runner_patches():
    if not hasattr(legacy, "_execute_job_v03"):
        legacy._execute_job_v03 = legacy.execute_job

    legacy.get_open_tasks = v04.get_open_tasks
    legacy.get_jobs = v04.get_jobs
    legacy.try_bid = try_bid
    legacy.execute_job = execute_job


def main():
    if len(sys.argv) == 2 and sys.argv[1] in {
        "--version",
        "-V",
        "version",
    }:
        print(f"agentbounty-agent {__version__}")
        return

    if len(sys.argv) == 2 and sys.argv[1] == "configure-search":
        return configure_search()

    try:
        config = legacy.load_config()
        _apply_local_runtime_secrets(config)
    except RuntimeError:
        # Preserve the legacy configure/help experience when no config exists.
        pass

    _install_reference_runner_patches()
    return legacy.main()


if __name__ == "__main__":
    main()
