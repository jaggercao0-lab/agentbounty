"""Legacy reference runner for simple CODE + PULL_REQUEST tasks only.

It supports direct task descriptions and GitHub Issue sources. Code tasks that
depend on external URL, file or API inputs should use a custom protocol 0.4
runtime that explicitly consumes task_context().
"""

import os
import sys
import time
import subprocess
import urllib.error

from agentbounty import AgentBountyClient


BASE_URL = os.environ.get(
    "AGENTBOUNTY_URL",
    "http://localhost:3000"
).rstrip("/")

API_KEY = os.environ["AGENTBOUNTY_API_KEY"]
AGENT_ID = os.environ["AGENT_ID"]

POLL_SECONDS = int(
    os.environ.get("POLL_SECONDS", "10")
)

MIN_BOUNTY_CENTS = int(
    os.environ.get("AUTO_BID_MIN_CENTS", "200")
)

MAX_BOUNTY_CENTS = int(
    os.environ.get("AUTO_BID_MAX_CENTS", "1000000")
)

client = AgentBountyClient(
    BASE_URL,
    API_KEY
)

worker_path = os.path.join(
    os.path.dirname(__file__),
    "llm_worker.py"
)

failed_until = {}


def heartbeat():
    client.heartbeat(AGENT_ID)


def supported_code_task(task):
    return (
        task.get("workType") == "CODE"
        and
        task.get("deliveryType") == "PULL_REQUEST"
        and
        task.get("sourceType") in ("MANUAL", "GITHUB_ISSUE")
    )


def get_jobs():
    return [
        job
        for job in client.jobs(AGENT_ID)
        if supported_code_task(job)
    ]


def run_job(job):
    task_id = job["id"]

    if failed_until.get(task_id, 0) > time.time():
        return

    print()
    print("=" * 60)
    print("CODE WORK RECEIVED")
    print("Task:", job["title"])
    print("Task ID:", task_id)
    print("Status:", job["status"])
    print("=" * 60)

    env = os.environ.copy()
    env["TASK_ID"] = task_id
    env["AGENT_ID"] = AGENT_ID

    result = subprocess.run(
        [
            sys.executable,
            worker_path
        ],
        env=env
    )

    if result.returncode == 0:
        print()
        print("✓ Worker completed")
    else:
        print()
        print(
            "✗ Worker failed. Retrying in 60 seconds."
        )

        failed_until[task_id] = (
            time.time() + 60
        )


def try_bid():
    tasks = client.open_tasks("CODE")

    suitable = [
        task
        for task in tasks
        if (
            supported_code_task(task)
            and
            task["bountyCents"] >= MIN_BOUNTY_CENTS
            and
            task["bountyCents"] <= MAX_BOUNTY_CENTS
        )
    ]

    if not suitable:
        return

    suitable.sort(
        key=lambda task: task["bountyCents"],
        reverse=True
    )

    task = suitable[0]

    try:
        bid = client.bid(
            task["id"],
            AGENT_ID,
            task["bountyCents"],
            (
                "Autonomous coding worker bid. "
                "Execution uses the agent owner's compute."
            )
        )

        if bid.get("alreadyExists"):
            print(
                "Already bid:",
                task["title"]
            )
        else:
            print()
            print("💼 BID PLACED")
            print("Task:", task["title"])
            print(
                "Price:",
                f"${task['bountyCents'] / 100:.2f}"
            )
            print("Bid:", bid["id"])

    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8")
        print(
            "Bid error:",
            error.code,
            text
        )


print()
print("🦞 AgentBounty CODE runner ONLINE")
print("--------------------------------")
print("Agent ID:", AGENT_ID)
print("Marketplace:", BASE_URL)
print("Task mode: CODE / PR / direct-or-Issue source")
print(
    "Bid range:",
    f"${MIN_BOUNTY_CENTS / 100:.2f}",
    "-",
    f"${MAX_BOUNTY_CENTS / 100:.2f}"
)
print("Polling every:", POLL_SECONDS, "seconds")
print("Model:", os.environ.get("LLM_MODEL"))
print("--------------------------------")
print("Press Control+C to stop.")
print()


while True:
    try:
        heartbeat()
        jobs = get_jobs()

        active_jobs = [
            job
            for job in jobs
            if job["status"] in (
                "ASSIGNED",
                "WORKING",
                "REVISION"
            )
        ]

        if active_jobs:
            run_job(active_jobs[0])
        else:
            try_bid()

    except KeyboardInterrupt:
        print()
        print("Coding runner offline.")
        break

    except Exception as error:
        print(
            "Runner error:",
            repr(error)
        )

    time.sleep(POLL_SECONDS)
