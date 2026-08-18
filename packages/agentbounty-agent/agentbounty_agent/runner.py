"""Bundled AgentBounty reference runner.

The marketplace protocol is 0.4. This module adds implementation-specific
execution gating so the bundled worker only bids on task/delivery combinations
it can actually finish, while protocol details live in cli_v04.
"""

import getpass
import json
import os
import sys
import time

from . import __version__
from . import cli as legacy
from . import cli_v04 as v04


_LEGACY_CONFIGURE = legacy.configure
_BASE_GENERAL_TASK_PROMPT = v04._general_task_prompt

SUPPORTED_GENERAL_PATHS = {
    ("RESEARCH", "TEXT"),
    ("RESEARCH", "JSON"),
    ("DATA", "TEXT"),
    ("DATA", "JSON"),
    ("AUTOMATION", "TEXT"),
    ("AUTOMATION", "JSON"),
    ("OTHER", "TEXT"),
    ("OTHER", "JSON"),
}


def can_execute_task(task):
    work_type = str(task.get("workType") or "CODE").upper()
    delivery_type = str(
        task.get("deliveryType") or "PULL_REQUEST"
    ).upper()

    if work_type == "CODE" and delivery_type == "PULL_REQUEST":
        return True

    return (work_type, delivery_type) in SUPPORTED_GENERAL_PATHS


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


def revision_aware_prompt(context, research_evidence=None):
    """Build a revision prompt where feedback augments, not replaces, the task."""
    task = dict(context.get("task") or {})
    revision = (
        context.get("revision")
        or task.get("revision")
        or {}
    )

    feedback = str(revision.get("feedback") or "").strip()
    previous = revision.get("previousSubmission")

    if not feedback and not previous:
        return _BASE_GENERAL_TASK_PROMPT(
            context,
            research_evidence=research_evidence,
        )

    # Present the original contract separately from revision-only state so the
    # model cannot confuse the latest feedback with a replacement task.
    original_task = dict(task)
    original_task.pop("revision", None)

    base_context = dict(context)
    base_context["task"] = original_task
    base_context.pop("revision", None)

    base_prompt = _BASE_GENERAL_TASK_PROMPT(
        base_context,
        research_evidence=research_evidence,
    )

    return (
        base_prompt
        + "\n\n"
        + "REVISION MODE — IMPORTANT:\n"
        + "This is a revision of the SAME paid task, not a new task.\n"
        + "The original TASK above remains authoritative in full.\n"
        + "The revision feedback supplements the original contract unless it "
        + "explicitly asks to replace or remove something.\n\n"
        + "REVISION INSTRUCTIONS:\n"
        + (feedback or "No written feedback was supplied.")
        + "\n\n"
        + "PREVIOUS DELIVERY:\n"
        + json.dumps(
            previous,
            ensure_ascii=False,
            indent=2,
        )
        + "\n\n"
        + "Revision requirements:\n"
        + "- Produce a COMPLETE replacement deliverable, not only the changed "
        + "section or the new material requested in feedback.\n"
        + "- Continue to satisfy the original title, description, source "
        + "requirements, and EVERY original acceptance criterion.\n"
        + "- Apply the revision instructions in addition to those original "
        + "requirements.\n"
        + "- Preserve correct and still-relevant content from the previous "
        + "delivery unless the feedback requires changing or removing it.\n"
        + "- Before returning the final answer, check that a reader can use "
        + "this revision by itself without seeing the previous delivery."
    )


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


def configure_preserving_search():
    """Run legacy setup without discarding local search credentials."""
    preserved = {}

    try:
        existing = legacy.load_config()
        for key in ("search_provider", "search_api_key"):
            value = existing.get(key)
            if value:
                preserved[key] = value
    except RuntimeError:
        pass

    _LEGACY_CONFIGURE()

    if not preserved:
        return

    updated = legacy.load_config()
    updated.update(preserved)
    legacy.save_config(updated)


def _apply_local_runtime_secrets(config):
    search_key = str(config.get("search_api_key") or "").strip()

    # Explicit environment variables take precedence for ephemeral/CI usage.
    if search_key and not os.environ.get("TAVILY_API_KEY"):
        os.environ["TAVILY_API_KEY"] = search_key


def _select_runnable_job(active, failed_until, now):
    for job in active:
        if failed_until.get(job["id"], 0) <= now:
            return job
    return None


def run_reference():
    config = legacy.load_config()
    _apply_local_runtime_secrets(config)

    failed_until = {}

    print()
    print("🦞 AgentBounty Agent ONLINE")
    print("--------------------------------")
    print("Agent:", config["agent_id"])
    print("Marketplace:", config["marketplace_url"])
    print("Provider:", config.get("provider", "openrouter"))
    print("Model:", config["llm_model"])
    print(
        "Minimum bounty:",
        f"${config['min_bounty_cents'] / 100:.2f}",
    )
    print("--------------------------------")
    print("Press Control+C to stop.")
    print()

    while True:
        try:
            legacy.heartbeat(config)

            jobs = v04.get_jobs(config)
            active = [
                job
                for job in jobs
                if job["status"] in (
                    "ASSIGNED",
                    "WORKING",
                    "REVISION",
                )
            ]

            job = _select_runnable_job(
                active,
                failed_until,
                time.time(),
            )

            if job is not None:
                try:
                    execute_job(config, job)

                    failed_until.pop(job["id"], None)
                    print()
                    print("✓ Worker completed")

                except Exception as error:
                    print()
                    print("Worker failed:", repr(error))
                    print("Retrying this job in 60 seconds.")
                    failed_until[job["id"]] = time.time() + 60

            elif not active:
                try_bid(config)

        except KeyboardInterrupt:
            print()
            print("Agent offline.")
            break

        except Exception as error:
            print("Runner error:", repr(error))

        time.sleep(config["poll_seconds"])


def _install_reference_runner_patches():
    if not hasattr(legacy, "_execute_job_v03"):
        legacy._execute_job_v03 = legacy.execute_job

    legacy.configure = configure_preserving_search
    legacy.get_open_tasks = v04.get_open_tasks
    legacy.get_jobs = v04.get_jobs
    legacy.try_bid = try_bid
    legacy.execute_job = execute_job
    legacy.run = run_reference
    v04._general_task_prompt = revision_aware_prompt


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
