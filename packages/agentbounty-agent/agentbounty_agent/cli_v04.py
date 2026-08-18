"""Protocol 0.4 runner extensions for AgentBounty.

This module keeps the proven 0.3 coding runner intact and patches in
General Task Market discovery, bidding, and general-task execution.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

from . import cli as legacy


PROTOCOL_QUERY = "protocol=0.4"
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
MAX_RESEARCH_QUERIES = 4
MAX_RESEARCH_SOURCES = 12
MAX_SOURCE_SNIPPET_CHARS = 1800


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


def _general_task_prompt(context, research_evidence=None):
    task = context.get("task") or {}
    source = context.get("source") or {}

    evidence_section = ""
    if research_evidence:
        evidence_section = (
            "\n\nWEB RESEARCH EVIDENCE:\n"
            + json.dumps(
                research_evidence,
                ensure_ascii=False,
                indent=2
            )
        )

    return f"""
You are an autonomous worker completing a paid task through AgentBounty.

TASK:
{json.dumps(task, ensure_ascii=False, indent=2)}

SOURCE:
{json.dumps(source, ensure_ascii=False, indent=2)}
{evidence_section}

Complete the task exactly as requested and satisfy every acceptance criterion.

Rules:
- Return only the final deliverable, not planning notes or hidden reasoning.
- Be specific, useful, and self-contained.
- Do not claim to have used tools, sources, files, or live data that were not provided.
- If web research evidence is provided, prefer it over model memory for time-sensitive factual claims.
- Never invent a citation. Only cite source IDs that appear in WEB RESEARCH EVIDENCE.
- When citing web evidence, place the source ID immediately after the supported claim, for example [S1].
- If web evidence is provided, end with a `## Sources` section listing each cited source as `- [S1] Title — URL`.
- If evidence is incomplete or conflicting, state the limitation rather than guessing.
- For TEXT delivery, use clean GitHub-flavored Markdown: headings, bullets, numbered lists, tables, links, bold text, and fenced code blocks are allowed.
- Never emit HTML layout tags such as <br>, <div>, <table>, or <p>; use Markdown syntax instead.
- Keep Markdown tables structurally valid: one header row, one separator row, then data rows with the same number of columns.
""".strip()


def _fallback_research_query(context):
    task = context.get("task") or {}
    title = str(task.get("title") or "").strip()
    description = str(task.get("description") or "").strip()

    query = " ".join(
        part for part in (title, description[:280]) if part
    ).strip()

    return query or "current information relevant to the task"


def _research_queries(config, context):
    task = context.get("task") or {}

    prompt = f"""
Create web-search queries for the research task below.

TASK:
{json.dumps(task, ensure_ascii=False, indent=2)}

Return ONLY JSON in this shape:
{{
  "queries": ["query one", "query two"]
}}

Rules:
- Return 2 to {MAX_RESEARCH_QUERIES} concise search queries.
- Cover the important comparison dimensions and any current/date-sensitive claims.
- Do not include commentary outside JSON.
""".strip()

    try:
        response = legacy.call_llm(
            config,
            [
                {
                    "role": "system",
                    "content": (
                        "You create precise web-search queries. "
                        "Return JSON only."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        parsed = legacy.parse_ai_json(response)
        raw_queries = parsed.get("queries") or []
    except Exception as error:
        print(
            "Research query planning failed; using fallback:",
            repr(error)
        )
        raw_queries = []

    queries = []
    seen = set()

    for value in raw_queries:
        if not isinstance(value, str):
            continue

        query = value.strip()
        key = query.lower()

        if not query or key in seen:
            continue

        seen.add(key)
        queries.append(query)

        if len(queries) >= MAX_RESEARCH_QUERIES:
            break

    if not queries:
        queries = [_fallback_research_query(context)]

    return queries


def _tavily_search(api_key, query, max_results=5):
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "topic": "general",
        "max_results": max_results,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
    }

    request = urllib.request.Request(
        TAVILY_SEARCH_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "AgentBounty-Agent/0.1"
        },
        method="POST"
    )

    try:
        result = legacy._read_json_response(
            request,
            timeout=60
        )
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = error.read().decode("utf-8")[:500]
        except Exception:
            pass

        raise RuntimeError(
            f"Tavily HTTP {error.code}: {detail}"
        ) from error

    except urllib.error.URLError as error:
        raise RuntimeError(
            f"Tavily connection failed: {error.reason}"
        ) from error

    return result.get("results") or []


def _collect_research_evidence(config, context):
    task = context.get("task") or {}

    if task.get("workType") != "RESEARCH":
        return [], {
            "researchMode": "not_applicable"
        }

    api_key = os.environ.get("TAVILY_API_KEY", "").strip()

    if not api_key:
        print()
        print(
            "[research] TAVILY_API_KEY is not set; "
            "continuing without live web evidence."
        )
        return [], {
            "researchMode": "model_only",
            "searchProvider": None,
            "sourceCount": 0,
        }

    queries = _research_queries(config, context)

    print()
    print("[research] Planned search queries:")
    for query in queries:
        print(" -", query)

    evidence = []
    seen_urls = set()

    for query in queries:
        if len(evidence) >= MAX_RESEARCH_SOURCES:
            break

        try:
            results = _tavily_search(
                api_key,
                query,
                max_results=5
            )
        except Exception as error:
            print(
                "[research] Search failed:",
                repr(error)
            )
            continue

        for result in results:
            url = str(result.get("url") or "").strip()
            title = str(result.get("title") or url).strip()
            content = str(result.get("content") or "").strip()

            if not url or url in seen_urls:
                continue

            seen_urls.add(url)

            evidence.append({
                "id": f"S{len(evidence) + 1}",
                "title": title[:300],
                "url": url[:5000],
                "snippet": content[:MAX_SOURCE_SNIPPET_CHARS],
                "score": result.get("score"),
                "query": query,
            })

            if len(evidence) >= MAX_RESEARCH_SOURCES:
                break

    print()
    print(
        "[research] Web evidence collected:",
        len(evidence),
        "sources"
    )

    metadata_sources = [
        {
            "id": item["id"],
            "title": item["title"],
            "url": item["url"],
        }
        for item in evidence
    ]

    return evidence, {
        "researchMode": (
            "web_grounded" if evidence else "model_only"
        ),
        "searchProvider": "tavily",
        "searchQueries": queries,
        "sourceCount": len(evidence),
        "researchSources": metadata_sources,
    }


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

    research_evidence, research_metadata = (
        _collect_research_evidence(config, context)
    )

    prompt = _general_task_prompt(
        context,
        research_evidence=research_evidence
    )

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
            "metadata": research_metadata,
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
            "metadata": research_metadata,
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
