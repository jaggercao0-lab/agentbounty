import os
import sys
import json
import time
import re
import getpass
import argparse
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path


CONFIG_DIR = Path.home() / ".agentbounty"
CONFIG_FILE = CONFIG_DIR / "config.json"


# ============================================================
# CONFIG
# ============================================================

def save_config(config):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    CONFIG_FILE.write_text(
        json.dumps(config, indent=2)
    )

    os.chmod(CONFIG_FILE, 0o600)


def load_config():
    if not CONFIG_FILE.exists():
        raise RuntimeError(
            "AgentBounty is not configured.\n"
            "Run: agentbounty-agent configure"
        )

    return json.loads(
        CONFIG_FILE.read_text()
    )


def configure():
    print()
    print("AgentBounty Agent Setup")
    print("=======================")
    print()

    existing = {}

    if CONFIG_FILE.exists():
        try:
            existing = load_config()
        except Exception:
            existing = {}

    marketplace = input(
        f"Marketplace URL [{existing.get('marketplace_url', 'http://localhost:3000')}]: "
    ).strip()

    if not marketplace:
        marketplace = existing.get(
            "marketplace_url",
            "http://localhost:3000"
        )

    agent_id = input(
        f"Agent ID [{existing.get('agent_id', '')}]: "
    ).strip()

    if not agent_id:
        agent_id = existing.get("agent_id", "")

    if not agent_id:
        raise RuntimeError("Agent ID is required.")

    print()
    print("Paste the private Runner Token generated")
    print("from AgentBounty → Agents → Connect your agent.")
    print()

    agent_token = getpass.getpass(
        "AgentBounty Runner Token: "
    ).strip()

    if not agent_token:
        agent_token = existing.get("agent_token", "")

    if not agent_token:
        raise RuntimeError(
            "Runner Token is required."
        )

    print()
    print()
    print("Connecting to AgentBounty...")

    config_url = (
        marketplace.rstrip("/")
        + f"/api/v1/agents/{agent_id}/config"
    )

    req = urllib.request.Request(
        config_url,
        headers={
            "x-api-key": agent_token,
            "Accept": "application/json"
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(
            req,
            timeout=15
        ) as response:
            remote_agent = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8")
        except Exception:
            detail = ""

        if e.code == 401:
            raise RuntimeError(
                "Agent ID or Runner Token is invalid."
            )

        raise RuntimeError(
            f"AgentBounty returned HTTP {e.code}: "
            f"{detail}"
        )

    except urllib.error.URLError as e:
        raise RuntimeError(
            "Could not connect to AgentBounty: "
            f"{e.reason}"
        )

    provider = str(
        remote_agent.get("provider", "")
    ).strip().lower()

    llm_model = str(
        remote_agent.get("modelName", "")
    ).strip()

    allowed = {
        "openrouter",
        "openai",
        "anthropic",
        "ollama",
        "custom"
    }

    if provider not in allowed:
        raise RuntimeError(
            f"Unsupported provider from AgentBounty: "
            f"{provider}"
        )

    if not llm_model:
        raise RuntimeError(
            "AgentBounty returned an empty model."
        )

    provider_defaults = {
        "openrouter":
            "https://openrouter.ai/api/v1",
        "openai":
            "https://api.openai.com/v1",
        "anthropic":
            "https://api.anthropic.com/v1",
        "ollama":
            "http://localhost:11434"
    }

    provider_labels = {
        "openrouter": "OpenRouter",
        "openai": "OpenAI",
        "anthropic": "Anthropic",
        "ollama": "Ollama",
        "custom": "Custom"
    }

    if provider == "custom":
        previous_base = (
            existing.get("llm_base_url", "")
            if existing.get("provider") == "custom"
            else ""
        )

        base_prompt = (
            f"Custom API base URL "
            f"[{previous_base}]: "
            if previous_base
            else "Custom API base URL: "
        )

        llm_base_url = (
            input(base_prompt).strip()
            or previous_base
        )

        if not llm_base_url:
            raise RuntimeError(
                "Custom API base URL is required."
            )

    else:
        llm_base_url = (
            provider_defaults[provider]
        )

    remote_minimum = remote_agent.get(
        "minimumJobCents"
    )

    if isinstance(remote_minimum, int):
        min_bounty_cents = remote_minimum
    else:
        min_bounty_cents = existing.get(
            "min_bounty_cents",
            200
        )

    print()
    print(
        "✓ Agent:",
        remote_agent.get(
            "name",
            agent_id
        )
    )
    print(
        "✓ Provider:",
        provider_labels[provider]
    )
    print(
        "✓ Model:",
        llm_model
    )
    print(
        "✓ Endpoint:",
        llm_base_url
    )
    print(
        "✓ Minimum bounty:",
        f"${min_bounty_cents / 100:.2f}"
    )
    print()

    llm_api_key = ""

    if provider == "ollama":
        print(
            "✓ Ollama does not require "
            "a provider API key."
        )

    else:
        previous_key = (
            existing.get("llm_api_key", "")
            if existing.get("provider") == provider
            else ""
        )

        if previous_key:
            key_prompt = (
                "Provider API Key "
                "[Enter to keep existing]: "
            )
        else:
            key_prompt = "Provider API Key: "

        entered_key = getpass.getpass(
            key_prompt
        ).strip()

        llm_api_key = (
            entered_key
            or previous_key
        )

        if not llm_api_key:
            raise RuntimeError(
                "Provider API Key is required."
            )

    poll = input(
        f"Polling interval seconds [{existing.get('poll_seconds', 10)}]: "
    ).strip()

    poll_seconds = (
        int(poll)
        if poll
        else existing.get(
            "poll_seconds",
            10
        )
    )

    config = {
        "marketplace_url": marketplace.rstrip("/"),
        "agent_id": agent_id,
        "agent_token": agent_token,

        "provider": provider,
        "llm_base_url": llm_base_url.rstrip("/"),
        "llm_model": llm_model,
        "llm_api_key": llm_api_key,

        "min_bounty_cents": min_bounty_cents,
        "max_bounty_cents": existing.get(
            "max_bounty_cents",
            1000000
        ),

        "poll_seconds": poll_seconds
    }

    save_config(config)

    print()
    print("✓ Configuration saved locally:")
    print(CONFIG_FILE)
    print()
    print("Next:")
    print("  agentbounty-agent doctor")
    print()


# ============================================================
# HTTP
# ============================================================

def api_request(
    config,
    path,
    method="GET",
    body=None
):
    data = None

    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(
        config["marketplace_url"] + path,
        data=data,
        headers={
            "x-api-key": config["agent_token"],
            "Content-Type": "application/json"
        },
        method=method
    )

    try:
        with urllib.request.urlopen(
            req,
            timeout=120
        ) as response:

            raw = response.read().decode("utf-8")

            return (
                json.loads(raw)
                if raw
                else {}
            )

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")

        raise RuntimeError(
            f"AgentBounty HTTP {e.code}: {body}"
        )


# ============================================================
# LLM
# ============================================================

def _read_json_response(req, timeout=180):
    with urllib.request.urlopen(
        req,
        timeout=timeout
    ) as response:
        raw = response.read().decode("utf-8")

    return json.loads(raw)


def _normalize_openai_content(result):
    choices = result.get("choices") or []

    if not choices:
        raise RuntimeError(
            "Provider returned no choices"
        )

    message = (
        choices[0].get("message")
        or {}
    )

    content = message.get("content")

    if isinstance(content, list):
        parts = []

        for item in content:
            if isinstance(item, dict):
                value = (
                    item.get("text")
                    or item.get("content")
                )

                if value:
                    parts.append(value)

        content = "\n".join(parts)

    if (
        not isinstance(content, str)
        or not content.strip()
    ):
        raise RuntimeError(
            "Provider returned empty content"
        )

    return content.strip()


def _call_openai_compatible(
    config,
    messages
):
    url = (
        config["llm_base_url"]
        + "/chat/completions"
    )

    payload = {
        "model": config["llm_model"],
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 4000
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/json",
            "Authorization":
                "Bearer "
                + config["llm_api_key"]
        },
        method="POST"
    )

    return _normalize_openai_content(
        _read_json_response(req)
    )


def _call_anthropic(
    config,
    messages
):
    system_parts = []
    anthropic_messages = []

    for message in messages:
        role = message.get("role")
        content = message.get(
            "content",
            ""
        )

        if role == "system":
            system_parts.append(content)
            continue

        anthropic_messages.append({
            "role":
                "assistant"
                if role == "assistant"
                else "user",
            "content": content
        })

    payload = {
        "model": config["llm_model"],
        "max_tokens": 4000,
        "temperature": 0.1,
        "messages": anthropic_messages
    }

    if system_parts:
        payload["system"] = "\n\n".join(
            system_parts
        )

    url = (
        config["llm_base_url"]
        + "/messages"
    )

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/json",
            "x-api-key":
                config["llm_api_key"],
            "anthropic-version":
                "2023-06-01"
        },
        method="POST"
    )

    result = _read_json_response(req)

    parts = []

    for item in result.get(
        "content",
        []
    ):
        if (
            isinstance(item, dict)
            and item.get("type") == "text"
        ):
            value = item.get("text")

            if value:
                parts.append(value)

    content = "\n".join(parts).strip()

    if not content:
        raise RuntimeError(
            "Anthropic returned empty content"
        )

    return content


def _call_ollama(
    config,
    messages
):
    url = (
        config["llm_base_url"]
        + "/api/chat"
    )

    payload = {
        "model": config["llm_model"],
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.1
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/json"
        },
        method="POST"
    )

    result = _read_json_response(
        req,
        timeout=300
    )

    message = (
        result.get("message")
        or {}
    )

    content = message.get("content")

    if (
        not isinstance(content, str)
        or not content.strip()
    ):
        raise RuntimeError(
            "Ollama returned empty content"
        )

    return content.strip()


def _read_json_response(req, timeout=180):
    with urllib.request.urlopen(
        req,
        timeout=timeout
    ) as response:
        raw = response.read().decode("utf-8")

    return json.loads(raw)


def _normalize_openai_content(result):
    choices = result.get("choices") or []

    if not choices:
        raise RuntimeError(
            "Provider returned no choices"
        )

    message = (
        choices[0].get("message")
        or {}
    )

    content = message.get("content")

    if isinstance(content, list):
        parts = []

        for item in content:
            if isinstance(item, dict):
                value = (
                    item.get("text")
                    or item.get("content")
                )

                if value:
                    parts.append(value)

        content = "\n".join(parts)

    if (
        not isinstance(content, str)
        or not content.strip()
    ):
        raise RuntimeError(
            "Provider returned empty content"
        )

    return content.strip()


def _call_openai_compatible(
    config,
    messages
):
    url = (
        config["llm_base_url"]
        + "/chat/completions"
    )

    payload = {
        "model": config["llm_model"],
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 4000
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/json",
            "Authorization":
                "Bearer "
                + config["llm_api_key"]
        },
        method="POST"
    )

    return _normalize_openai_content(
        _read_json_response(req)
    )


def _call_anthropic(
    config,
    messages
):
    system_parts = []
    anthropic_messages = []

    for message in messages:
        role = message.get("role")
        content = message.get(
            "content",
            ""
        )

        if role == "system":
            system_parts.append(content)
            continue

        anthropic_messages.append({
            "role":
                "assistant"
                if role == "assistant"
                else "user",
            "content": content
        })

    payload = {
        "model": config["llm_model"],
        "max_tokens": 4000,
        "temperature": 0.1,
        "messages": anthropic_messages
    }

    if system_parts:
        payload["system"] = "\n\n".join(
            system_parts
        )

    url = (
        config["llm_base_url"]
        + "/messages"
    )

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/json",
            "x-api-key":
                config["llm_api_key"],
            "anthropic-version":
                "2023-06-01"
        },
        method="POST"
    )

    result = _read_json_response(req)

    parts = []

    for item in result.get(
        "content",
        []
    ):
        if (
            isinstance(item, dict)
            and item.get("type") == "text"
        ):
            value = item.get("text")

            if value:
                parts.append(value)

    content = "\n".join(parts).strip()

    if not content:
        raise RuntimeError(
            "Anthropic returned empty content"
        )

    return content


def _call_ollama(
    config,
    messages
):
    url = (
        config["llm_base_url"]
        + "/api/chat"
    )

    payload = {
        "model": config["llm_model"],
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.1
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(
            "utf-8"
        ),
        headers={
            "Content-Type":
                "application/json"
        },
        method="POST"
    )

    result = _read_json_response(
        req,
        timeout=300
    )

    message = (
        result.get("message")
        or {}
    )

    content = message.get("content")

    if (
        not isinstance(content, str)
        or not content.strip()
    ):
        raise RuntimeError(
            "Ollama returned empty content"
        )

    return content.strip()


def call_llm(config, messages):
    provider = config.get(
        "provider",
        "openrouter"
    )

    last_error = None

    for attempt in range(1, 5):
        try:

            if provider in {
                "openrouter",
                "openai",
                "custom"
            }:
                return _call_openai_compatible(
                    config,
                    messages
                )

            if provider == "anthropic":
                return _call_anthropic(
                    config,
                    messages
                )

            if provider == "ollama":
                return _call_ollama(
                    config,
                    messages
                )

            raise RuntimeError(
                f"Unsupported provider: {provider}"
            )

        except Exception as e:
            last_error = e

            print(
                f"{provider} attempt "
                f"{attempt}/4 failed:",
                repr(e)
            )

            if attempt < 4:
                wait = attempt * 2

                print(
                    f"Retrying in {wait}s..."
                )

                time.sleep(wait)

    raise RuntimeError(
        f"{provider} failed after retries: "
        f"{last_error}"
    )


def parse_ai_json(text):
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text
        )

        text = re.sub(
            r"\s*```$",
            "",
            text
        )

    try:
        return json.loads(text)

    except json.JSONDecodeError:
        match = re.search(
            r"\{.*\}",
            text,
            re.DOTALL
        )

        if not match:
            raise RuntimeError(
                "AI did not return JSON:\n"
                + text
            )

        return json.loads(
            match.group(0)
        )


# ============================================================
# AGENT WORK
# ============================================================

def heartbeat(config):
    return api_request(
        config,
        f"/api/v1/agents/{config['agent_id']}/heartbeat",
        method="POST",
        body={}
    )


def get_jobs(config):
    result = api_request(
        config,
        f"/api/v1/agents/{config['agent_id']}/jobs"
    )

    return result.get(
        "jobs",
        []
    )


def get_open_tasks(config):
    result = api_request(
        config,
        "/api/v1/tasks"
    )

    if isinstance(result, list):
        return result

    if "tasks" in result:
        return result["tasks"]

    if "jobs" in result:
        return result["jobs"]

    return []


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

    if not suitable:
        return

    suitable.sort(
        key=lambda task:
            task["bountyCents"],
        reverse=True
    )

    task = suitable[0]

    result = api_request(
        config,
        f"/api/v1/tasks/{task['id']}/bids",
        method="POST",
        body={
            "agentId":
                config["agent_id"],

            "priceCents":
                task["bountyCents"],

            "message":
                "Autonomous AgentBounty worker. "
                "Execution uses the Agent Owner's "
                "own model and compute."
        }
    )

    if result.get("alreadyExists"):
        return

    print()
    print("💼 BID PLACED")
    print("Task:", task["title"])
    print(
        "Price:",
        f"${task['bountyCents'] / 100:.2f}"
    )


def execute_job(config, job):
    task_id = job["id"]
    agent_id = config["agent_id"]

    print()
    print("=" * 62)
    print("WORK RECEIVED")
    print("Task:", job["title"])
    print("Task ID:", task_id)
    print("=" * 62)

    encoded_agent_id = urllib.parse.quote(
        agent_id
    )

    work = api_request(
        config,
        (
            f"/api/v1/tasks/{task_id}/work-package"
            f"?agentId={encoded_agent_id}"
        )
    )

    print()
    print("[1] Work package received")

    available_files = [
        f["path"]
        for f in
        work["workspace"]["files"]
    ]

    planning_prompt = f"""
You are an autonomous software engineering agent
working through AgentBounty.

TASK:
{json.dumps(work["task"], indent=2)}

GITHUB ISSUE:
{json.dumps(work.get("issue"), indent=2)}

AVAILABLE FILES:
{json.dumps(available_files, indent=2)}

Select only the files required to complete the task.

Return ONLY JSON:

{{
  "read_files": [
    "path/to/file"
  ]
}}

Rules:
- Maximum 8 files.
- Only request files in AVAILABLE FILES.
- Never request .git files.
- Never request .github/workflows files.
"""

    planning = parse_ai_json(
        call_llm(
            config,
            [
                {
                    "role": "system",
                    "content":
                        "You are a careful autonomous "
                        "software engineer. Return JSON only."
                },
                {
                    "role": "user",
                    "content": planning_prompt
                }
            ]
        )
    )

    requested = (
        planning.get(
            "read_files",
            []
        )[:8]
    )

    requested = [
        path
        for path in requested
        if path in available_files
    ]

    print()
    print("[2] AI requested files:")

    for path in requested:
        print(" -", path)

    files = {}

    for path in requested:
        encoded_path = urllib.parse.quote(
            path,
            safe="/"
        )

        result = api_request(
            config,
            (
                f"/api/v1/tasks/{task_id}/file"
                f"?agentId={encoded_agent_id}"
                f"&path={encoded_path}"
            )
        )

        files[path] = result["content"]

    print()
    print(
        "[3] Files loaded:",
        len(files)
    )

    implementation_prompt = f"""
You are an autonomous software engineering agent
working for payment through AgentBounty.

TASK:
{json.dumps(work["task"], indent=2)}

GITHUB ISSUE:
{json.dumps(work.get("issue"), indent=2)}

REPOSITORY:
{json.dumps(work["repository"], indent=2)}

FILES:
{json.dumps(files, indent=2)}

Produce the exact changes required to satisfy all
acceptance criteria.

Rules:
- Make the smallest correct change.
- Preserve unrelated existing content.
- Never modify .github/workflows.
- Never expose secrets.
- Each content field must contain the COMPLETE
  final file, not a diff.

Return ONLY JSON:

{{
  "summary": "short description",
  "changes": [
    {{
      "path": "file",
      "content": "complete final file"
    }}
  ]
}}
"""

    solution = parse_ai_json(
        call_llm(
            config,
            [
                {
                    "role": "system",
                    "content":
                        "You are a precise autonomous "
                        "software engineer. Return JSON only."
                },
                {
                    "role": "user",
                    "content":
                        implementation_prompt
                }
            ]
        )
    )

    changes = solution.get(
        "changes",
        []
    )

    if not changes:
        raise RuntimeError(
            "AI returned no changes."
        )

    print()
    print("[4] AI generated changes:")

    for change in changes:
        print(
            " -",
            change["path"]
        )

    delivery = api_request(
        config,
        f"/api/v1/tasks/{task_id}/changes",
        method="POST",
        body={
            "agentId": agent_id,
            "summary":
                solution.get(
                    "summary",
                    "Task completed."
                ),
            "changes": changes
        }
    )

    print()
    print("[5] DELIVERY COMPLETE")
    print(
        "Status:",
        delivery.get("status")
    )
    print(
        "PR:",
        delivery.get("pullRequest")
    )


# ============================================================
# DOCTOR
# ============================================================

def doctor():
    config = load_config()

    print()
    print("AgentBounty Doctor")
    print("==================")
    print()

    print("Marketplace...", end=" ")

    result = heartbeat(config)

    if result.get("ok"):
        print("✓")
    else:
        print("FAILED")
        return

    print("Agent identity...", end=" ")

    if (
        result.get("agentId")
        == config["agent_id"]
    ):
        print("✓")
    else:
        print("FAILED")
        return

    print("LLM provider...", end=" ")

    response = call_llm(
        config,
        [
            {
                "role": "user",
                "content":
                    'Return only JSON: {"ok":true}'
            }
        ]
    )

    parsed = parse_ai_json(response)

    if parsed.get("ok") is True:
        print("✓")
    else:
        print("FAILED")
        return

    print()
    print("✓ Agent is ready to work.")
    print()


# ============================================================
# RUNNER
# ============================================================

def run():
    config = load_config()

    failed_until = {}

    print()
    print("🦞 AgentBounty Agent ONLINE")
    print("--------------------------------")
    print("Agent:", config["agent_id"])
    print(
        "Marketplace:",
        config["marketplace_url"]
    )
    print(
        "Provider:",
        config.get(
            "provider",
            "openrouter"
        )
    )
    print(
        "Model:",
        config["llm_model"]
    )
    print(
        "Minimum bounty:",
        f"${config['min_bounty_cents'] / 100:.2f}"
    )
    print("--------------------------------")
    print("Press Control+C to stop.")
    print()

    while True:
        try:
            heartbeat(config)

            jobs = get_jobs(config)

            active = [
                job
                for job in jobs
                if job["status"] in (
                    "ASSIGNED",
                    "WORKING",
                    "REVISION"
                )
            ]

            if active:
                job = active[0]

                if (
                    failed_until.get(
                        job["id"],
                        0
                    )
                    > time.time()
                ):
                    pass

                else:
                    try:
                        execute_job(
                            config,
                            job
                        )

                        print()
                        print(
                            "✓ Worker completed"
                        )

                    except Exception as e:
                        print()
                        print(
                            "Worker failed:",
                            repr(e)
                        )

                        print(
                            "Retrying this job "
                            "in 60 seconds."
                        )

                        failed_until[
                            job["id"]
                        ] = (
                            time.time()
                            + 60
                        )

            else:
                try_bid(config)

        except KeyboardInterrupt:
            print()
            print("Agent offline.")
            break

        except Exception as e:
            print(
                "Runner error:",
                repr(e)
            )

        time.sleep(
            config["poll_seconds"]
        )


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        prog="agentbounty-agent"
    )

    sub = parser.add_subparsers(
        dest="command"
    )

    sub.add_parser(
        "configure",
        help="Configure this AI worker"
    )

    sub.add_parser(
        "doctor",
        help="Test AgentBounty and LLM connectivity"
    )

    sub.add_parser(
        "run",
        help="Start the autonomous worker"
    )

    args = parser.parse_args()

    try:
        if args.command == "configure":
            configure()

        elif args.command == "doctor":
            doctor()

        elif args.command == "run":
            run()

        else:
            parser.print_help()

    except KeyboardInterrupt:
        print()

    except Exception as e:
        print()
        print("ERROR:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
