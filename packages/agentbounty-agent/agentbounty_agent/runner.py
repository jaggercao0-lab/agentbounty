"""Bundled AgentBounty reference runner.

The marketplace protocol is 0.4. This module adds implementation-specific
execution gating so the bundled worker only bids on task/delivery combinations
it can actually finish, while protocol details live in cli_v04.
"""

import builtins
import getpass
import ipaddress
import json
import os
import sys
import time
import urllib.parse

from . import __version__
from . import cli as legacy
from . import cli_v04 as v04
from . import video


_LEGACY_CONFIGURE = legacy.configure
_LEGACY_API_REQUEST = legacy.api_request
_BASE_GENERAL_TASK_PROMPT = v04._general_task_prompt
_BASE_HYDRATE_TASK_SOURCE = v04._hydrate_task_source
_BASE_COLLECT_RESEARCH_EVIDENCE = v04._collect_research_evidence

MIN_POLL_SECONDS = 5
MAX_POLL_SECONDS = 300

SUPPORTED_GENERAL_PATHS = {
    ("RESEARCH", "TEXT"),
    ("RESEARCH", "JSON"),
    ("VIDEO", "FILE"),
    ("DATA", "TEXT"),
    ("DATA", "JSON"),
    ("AUTOMATION", "TEXT"),
    ("AUTOMATION", "JSON"),
    ("OTHER", "TEXT"),
    ("OTHER", "JSON"),
}

SUPPORTED_ACTIONS = {
    "WEB_SEARCH",
    "SOURCE_FETCH",
    "VIDEO_GENERATE",
}


def _is_loopback_host(hostname):
    value = str(hostname or "").strip().lower().rstrip(".")
    if value == "localhost" or value.endswith(".localhost"):
        return True

    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def _validate_secret_bearing_url(value, label):
    raw = str(value or "").strip()
    if not raw:
        raise RuntimeError(f"{label} is required.")

    try:
        parsed = urllib.parse.urlsplit(raw)
    except ValueError as error:
        raise RuntimeError(f"Invalid {label}.") from error

    if not parsed.hostname:
        raise RuntimeError(f"{label} must include a hostname.")

    if parsed.username is not None or parsed.password is not None:
        raise RuntimeError(
            f"{label} must not contain embedded username/password credentials."
        )

    scheme = parsed.scheme.lower()
    if scheme == "https":
        pass
    elif scheme == "http" and _is_loopback_host(parsed.hostname):
        pass
    else:
        raise RuntimeError(
            f"{label} must use HTTPS. Plain HTTP is allowed only for localhost."
        )

    if parsed.query or parsed.fragment:
        raise RuntimeError(
            f"{label} must be a base URL without query parameters or fragments."
        )

    return raw.rstrip("/")


def _validated_poll_seconds(value):
    try:
        poll_seconds = int(value)
    except (TypeError, ValueError) as error:
        raise RuntimeError("Polling interval must be an integer number of seconds.") from error

    if not MIN_POLL_SECONDS <= poll_seconds <= MAX_POLL_SECONDS:
        raise RuntimeError(
            "Polling interval must be between "
            f"{MIN_POLL_SECONDS} and {MAX_POLL_SECONDS} seconds."
        )

    return poll_seconds


def validate_runtime_config(config):
    """Reject configs that could leak secrets or overload the marketplace."""
    if not isinstance(config, dict):
        raise RuntimeError("AgentBounty configuration is invalid.")

    config["marketplace_url"] = _validate_secret_bearing_url(
        config.get("marketplace_url"),
        "Marketplace URL",
    )

    provider = str(config.get("provider") or "").strip().lower()
    base_url = str(config.get("llm_base_url") or "").strip()
    if provider and base_url:
        config["llm_base_url"] = _validate_secret_bearing_url(
            base_url,
            "Model endpoint",
        )

    config["poll_seconds"] = _validated_poll_seconds(
        config.get("poll_seconds", 10)
    )
    return config


def _secure_api_request(config, path, method="GET", body=None):
    """Validate transport before any Runner Token leaves the machine."""
    _validate_secret_bearing_url(
        config.get("marketplace_url"),
        "Marketplace URL",
    )
    return _LEGACY_API_REQUEST(
        config,
        path,
        method=method,
        body=body,
    )


def _requested_actions(task):
    raw = task.get("requestedActions") or []

    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            raw = []

    if not isinstance(raw, list):
        return set()

    return {
        str(value).strip().upper()
        for value in raw
        if str(value).strip()
    }


def _has_search_credentials(config=None):
    if os.environ.get("TAVILY_API_KEY", "").strip():
        return True

    if config and str(config.get("search_api_key") or "").strip():
        return True

    return False


def runtime_action_capabilities(config=None):
    """Return only actions this local runner can execute right now."""
    capabilities = {"SOURCE_FETCH"}

    if _has_search_credentials(config):
        capabilities.add("WEB_SEARCH")

    if video.video_runtime_available(config):
        capabilities.add("VIDEO_GENERATE")

    return capabilities


def runtime_work_capabilities(config=None):
    """Return work types whose support is managed by runtime configuration."""
    capabilities = set()

    if video.video_runtime_available(config):
        capabilities.add("VIDEO")

    return capabilities


def runtime_heartbeat(config):
    capabilities = sorted(runtime_action_capabilities(config))
    work_capabilities = sorted(runtime_work_capabilities(config))

    return legacy.api_request(
        config,
        f"/api/v1/agents/{config['agent_id']}/heartbeat",
        method="POST",
        body={
            "runtimeCapabilities": capabilities,
            "runtimeWorkCapabilities": work_capabilities,
        },
    )


def can_execute_task(task, config=None):
    work_type = str(task.get("workType") or "CODE").upper()
    delivery_type = str(
        task.get("deliveryType") or "PULL_REQUEST"
    ).upper()
    source_type = str(task.get("sourceType") or "MANUAL").upper()

    if work_type == "CODE" and delivery_type == "PULL_REQUEST":
        base_supported = True
    else:
        base_supported = (
            (work_type, delivery_type) in SUPPORTED_GENERAL_PATHS
        )

    if not base_supported:
        return False

    requested_actions = _requested_actions(task)

    if requested_actions - SUPPORTED_ACTIONS:
        return False

    available_actions = runtime_action_capabilities(config)
    if requested_actions - available_actions:
        return False

    if "WEB_SEARCH" in requested_actions:
        if work_type != "RESEARCH":
            return False

    if "SOURCE_FETCH" in requested_actions:
        if source_type not in {"URL", "FILE", "API"}:
            return False

    if work_type == "VIDEO":
        if delivery_type != "FILE":
            return False
        if "VIDEO_GENERATE" not in requested_actions:
            return False
        if not video.video_runtime_available(config):
            return False

    if "VIDEO_GENERATE" in requested_actions and work_type != "VIDEO":
        return False

    return True


def _hydrate_required_source(context):
    hydrated, metadata = _BASE_HYDRATE_TASK_SOURCE(context)
    requested_actions = _requested_actions(
        context.get("task") or {}
    )

    if "SOURCE_FETCH" in requested_actions:
        fetch_metadata = metadata.get("sourceFetch") or {}
        if not fetch_metadata.get("attempted"):
            raise RuntimeError(
                "Task requires SOURCE_FETCH but no external source was available."
            )
        if not fetch_metadata.get("ok"):
            detail = fetch_metadata.get("error") or "source retrieval failed"
            raise RuntimeError(
                "Task requires SOURCE_FETCH but the source could not be fetched: "
                f"{detail}"
            )

    return hydrated, metadata


def _collect_required_research_evidence(config, context):
    evidence, metadata = _BASE_COLLECT_RESEARCH_EVIDENCE(
        config,
        context,
    )
    requested_actions = _requested_actions(
        context.get("task") or {}
    )

    if "WEB_SEARCH" in requested_actions and not evidence:
        raise RuntimeError(
            "Task requires WEB_SEARCH but no live web evidence was collected."
        )

    return evidence, metadata


def try_bid(config):
    tasks = v04.get_open_tasks(config)

    suitable = [
        task
        for task in tasks
        if (
            task["bountyCents"] >= config["min_bounty_cents"]
            and task["bountyCents"] <= config["max_bounty_cents"]
            and can_execute_task(task, config)
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
        actions = sorted(_requested_actions(task))
        if actions:
            print("Actions:", ", ".join(actions))

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
    if not can_execute_task(job, config):
        actions = sorted(_requested_actions(job))
        action_note = (
            f" Requested actions: {', '.join(actions)}."
            if actions
            else ""
        )
        raise RuntimeError(
            "Bundled AgentBounty runner cannot execute "
            f"{job.get('workType')} + {job.get('deliveryType')}."
            + action_note
        )

    if (
        job.get("workType") == "CODE"
        and job.get("deliveryType") == "PULL_REQUEST"
    ):
        return legacy._execute_job_v03(config, job)

    if (
        job.get("workType") == "VIDEO"
        and job.get("deliveryType") == "FILE"
    ):
        return video.execute_video_job(config, job)

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
    print("  WEB_SEARCH will be advertised on the next heartbeat.")
    print()


def configure_video():
    config = legacy.load_config()
    existing_key = str(config.get("video_api_key") or "").strip()
    existing_model = str(
        config.get("video_model") or video.DEFAULT_VEO_MODEL
    ).strip()

    print()
    print("AgentBounty Video Agent Setup")
    print("=============================")
    print()
    print(
        "Configure Google Veo locally. The Gemini API key remains on this "
        "machine and is never sent to the AgentBounty marketplace."
    )
    print()

    key_prompt = (
        "Gemini API Key [Enter to keep existing]: "
        if existing_key
        else "Gemini API Key: "
    )
    entered_key = getpass.getpass(key_prompt).strip()
    api_key = entered_key or existing_key

    if not api_key:
        raise RuntimeError("Gemini API Key is required.")

    model = input(
        f"Veo model [{existing_model}]: "
    ).strip() or existing_model

    if not model.startswith("veo-"):
        raise RuntimeError("Video model must be a Veo model identifier.")

    config["video_provider"] = "veo"
    config["video_model"] = model
    config["video_api_key"] = api_key
    legacy.save_config(config)

    print()
    print("✓ Video Agent enabled locally.")
    print("  Provider: Google Veo")
    print("  Model:", model)
    print("  Key: stored locally (not displayed)")
    print("  VIDEO + VIDEO_GENERATE will be advertised on the next heartbeat.")
    print()


def configure_preserving_integrations():
    """Run legacy setup while enforcing transport/polling safety."""
    preserved = {}
    existing = {}

    try:
        existing = legacy.load_config()
        for key in (
            "search_provider",
            "search_api_key",
            "video_provider",
            "video_model",
            "video_api_key",
        ):
            value = existing.get(key)
            if value:
                preserved[key] = value
    except RuntimeError:
        existing = {}

    original_input = builtins.input

    def secure_input(prompt=""):
        entered = original_input(prompt)
        stripped = entered.strip()

        if prompt.startswith("Marketplace URL"):
            effective = stripped or existing.get(
                "marketplace_url",
                "http://localhost:3000",
            )
            _validate_secret_bearing_url(effective, "Marketplace URL")

        elif prompt.startswith("Custom API base URL"):
            effective = stripped or (
                existing.get("llm_base_url", "")
                if existing.get("provider") == "custom"
                else ""
            )
            if effective:
                _validate_secret_bearing_url(effective, "Model endpoint")

        elif prompt.startswith("Polling interval seconds"):
            effective = stripped or existing.get("poll_seconds", 10)
            _validated_poll_seconds(effective)

        return entered

    builtins.input = secure_input
    try:
        _LEGACY_CONFIGURE()
    finally:
        builtins.input = original_input

    updated = legacy.load_config()
    validate_runtime_config(updated)

    if preserved:
        updated.update(preserved)

    legacy.save_config(updated)


def _apply_local_runtime_secrets(config):
    search_key = str(config.get("search_api_key") or "").strip()
    video_key = str(config.get("video_api_key") or "").strip()

    if search_key and not os.environ.get("TAVILY_API_KEY"):
        os.environ["TAVILY_API_KEY"] = search_key

    if video_key and not os.environ.get("GEMINI_API_KEY"):
        os.environ["GEMINI_API_KEY"] = video_key


def _select_runnable_job(active, failed_until, now):
    for job in active:
        if failed_until.get(job["id"], 0) <= now:
            return job
    return None


def run_reference():
    config = legacy.load_config()
    validate_runtime_config(config)
    _apply_local_runtime_secrets(config)

    failed_until = {}
    runtime_actions = sorted(runtime_action_capabilities(config))
    runtime_work = sorted(runtime_work_capabilities(config))

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
    print(
        "Runtime actions:",
        ", ".join(runtime_actions) if runtime_actions else "none",
    )
    print(
        "Runtime work:",
        ", ".join(runtime_work) if runtime_work else "none",
    )
    if video.video_runtime_available(config):
        print("Video model:", video.video_model(config))
    print("--------------------------------")
    print("Press Control+C to stop.")
    print()

    while True:
        try:
            runtime_heartbeat(config)

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

    legacy.api_request = _secure_api_request
    legacy.configure = configure_preserving_integrations
    legacy.get_open_tasks = v04.get_open_tasks
    legacy.get_jobs = v04.get_jobs
    legacy.try_bid = try_bid
    legacy.execute_job = execute_job
    legacy.run = run_reference
    v04._general_task_prompt = revision_aware_prompt
    v04._hydrate_task_source = _hydrate_required_source
    v04._collect_research_evidence = _collect_required_research_evidence


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

    if len(sys.argv) == 2 and sys.argv[1] == "configure-video":
        return configure_video()

    command = sys.argv[1] if len(sys.argv) >= 2 else ""
    if command != "configure":
        try:
            config = legacy.load_config()
            validate_runtime_config(config)
            _apply_local_runtime_secrets(config)
        except RuntimeError:
            if command in {"run", "doctor"}:
                raise

    _install_reference_runner_patches()
    return legacy.main()


if __name__ == "__main__":
    main()
