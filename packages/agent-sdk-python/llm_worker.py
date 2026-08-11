import os
import json
import re
import urllib.request
import urllib.parse
import urllib.error


AGENTBOUNTY_URL = os.environ.get(
    "AGENTBOUNTY_URL",
    "http://localhost:3000"
).rstrip("/")

AGENTBOUNTY_API_KEY = os.environ["AGENTBOUNTY_API_KEY"]

TASK_ID = os.environ["TASK_ID"]
AGENT_ID = os.environ["AGENT_ID"]

LLM_BASE_URL = os.environ["LLM_BASE_URL"].rstrip("/")
LLM_MODEL = os.environ["LLM_MODEL"]
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")


def request_json(url, method="GET", body=None, agent_auth=False):
    headers = {
        "Content-Type": "application/json"
    }

    if agent_auth:
        headers["x-api-key"] = AGENTBOUNTY_API_KEY

    data = None

    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method
    )

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))

    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        raise RuntimeError(
            f"HTTP {e.code}: {text}"
        )


def call_llm(messages):
    url = f"{LLM_BASE_URL}/chat/completions"

    headers = {
        "Content-Type": "application/json"
    }

    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": 0.1
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        raise RuntimeError(
            f"LLM HTTP {e.code}: {text}"
        )

    return data["choices"][0]["message"]["content"]


def parse_json(text):
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
                f"AI did not return JSON:\n{text}"
            )

        return json.loads(match.group(0))


print("=== AgentBounty LLM Worker ===")
print("Task:", TASK_ID)
print("Agent:", AGENT_ID)
print("Model:", LLM_MODEL)


# --------------------------------------------------
# 1. Get Work Package
# --------------------------------------------------

work_url = (
    f"{AGENTBOUNTY_URL}/api/v1/tasks/"
    f"{TASK_ID}/work-package"
    f"?agentId={urllib.parse.quote(AGENT_ID)}"
)

work = request_json(
    work_url,
    agent_auth=True
)

print("\n[1] Work package received")
print("Task:", work["task"]["title"])
print("Repository:", work["repository"]["fullName"])


# --------------------------------------------------
# 2. Ask AI which files it needs
# --------------------------------------------------

file_list = [
    f["path"]
    for f in work["workspace"]["files"]
]

planning_prompt = f"""
You are an autonomous software engineering agent.

You are working through AgentBounty.

TASK:
{json.dumps(work["task"], indent=2)}

GITHUB ISSUE:
{json.dumps(work.get("issue"), indent=2)}

AVAILABLE REPOSITORY FILES:
{json.dumps(file_list, indent=2)}

Determine which existing files you need to read before
implementing this task.

Return ONLY valid JSON in this exact shape:

{{
  "read_files": [
    "path/to/file"
  ]
}}

Rules:
- Read only files that are relevant.
- Maximum 8 files.
- Do not request .git files.
- Do not request files under .github/workflows.
"""

planning_response = call_llm([
    {
        "role": "system",
        "content":
            "You are a careful autonomous software engineer."
    },
    {
        "role": "user",
        "content": planning_prompt
    }
])

plan = parse_json(planning_response)

requested_files = plan.get(
    "read_files",
    []
)[:8]

# Only allow files actually advertised by AgentBounty.
requested_files = [
    p for p in requested_files
    if p in file_list
]

print("\n[2] AI requested files:")

for path in requested_files:
    print(" -", path)


# --------------------------------------------------
# 3. Read requested files through AgentBounty
# --------------------------------------------------

files = {}

for path in requested_files:
    encoded_path = urllib.parse.quote(
        path,
        safe="/"
    )

    file_url = (
        f"{AGENTBOUNTY_URL}/api/v1/tasks/"
        f"{TASK_ID}/file"
        f"?agentId={urllib.parse.quote(AGENT_ID)}"
        f"&path={encoded_path}"
    )

    result = request_json(
        file_url,
        agent_auth=True
    )

    files[path] = result["content"]


print(
    "\n[3] Files loaded through AgentBounty:",
    len(files)
)


# --------------------------------------------------
# 4. Ask AI to perform task
# --------------------------------------------------

implementation_prompt = f"""
You are an autonomous software engineering agent working
for payment through AgentBounty.

TASK:
{json.dumps(work["task"], indent=2)}

GITHUB ISSUE:
{json.dumps(work.get("issue"), indent=2)}

REPOSITORY:
{json.dumps(work["repository"], indent=2)}

FILES YOU REQUESTED:
{json.dumps(files, indent=2)}

Produce the exact file changes required to satisfy the task
and acceptance criteria.

IMPORTANT:
- Preserve unrelated existing content.
- Make the smallest correct change.
- Do not modify .github/workflows.
- Do not expose secrets.
- "content" must contain the COMPLETE final file content,
  not a diff.
- Do not invent files unless the task requires them.

Return ONLY valid JSON:

{{
  "summary": "short explanation of what was changed",
  "changes": [
    {{
      "path": "README.md",
      "content": "complete final contents of the file"
    }}
  ]
}}
"""

implementation_response = call_llm([
    {
        "role": "system",
        "content":
            "You are a precise autonomous software "
            "engineering agent. Return only JSON."
    },
    {
        "role": "user",
        "content": implementation_prompt
    }
])

solution = parse_json(
    implementation_response
)

summary = solution.get(
    "summary",
    "AI completed the requested task."
)

changes = solution.get(
    "changes",
    []
)

if not changes:
    raise RuntimeError(
        "AI returned no file changes."
    )

print("\n[4] AI generated changes:")

for change in changes:
    print(" -", change["path"])


# --------------------------------------------------
# 5. Submit changes to AgentBounty
# --------------------------------------------------

changes_url = (
    f"{AGENTBOUNTY_URL}/api/v1/tasks/"
    f"{TASK_ID}/changes"
)

delivery = request_json(
    changes_url,
    method="POST",
    body={
        "agentId": AGENT_ID,
        "summary": summary,
        "changes": changes
    },
    agent_auth=True
)

print("\n[5] DELIVERY COMPLETE")
print("Status:", delivery.get("status"))
print("PR:", delivery.get("pullRequest"))
print("Branch:", delivery.get("branch"))
