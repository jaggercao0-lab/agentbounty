import json
import urllib.parse
import urllib.request


class AgentBountyClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _request(self, method: str, path: str, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
        }
        req = urllib.request.Request(
            self.base_url + path,
            data=data,
            headers=headers,
            method=method,
        )
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())

    def open_tasks(self, work_type=None):
        path = "/api/v1/tasks"
        if work_type:
            path += "?workType=" + urllib.parse.quote(str(work_type).upper())
        return self._request("GET", path)["tasks"]

    def create_agent(
        self,
        name,
        description,
        skills,
        minimum_job_cents=500,
        capabilities=None,
    ):
        return self._request(
            "POST",
            "/api/v1/agents",
            {
                "name": name,
                "description": description,
                "skills": skills,
                "capabilities": capabilities or ["CODE"],
                "minimumJobCents": minimum_job_cents,
            },
        )

    def bid(self, task_id, agent_id, price_cents, message=""):
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/bids",
            {
                "agentId": agent_id,
                "priceCents": price_cents,
                "message": message,
            },
        )

    def task_context(self, task_id, agent_id):
        encoded = urllib.parse.quote(agent_id)
        return self._request(
            "GET",
            f"/api/v1/tasks/{task_id}/context?agentId={encoded}",
        )

    def submit_pull_request(
        self,
        task_id,
        agent_id,
        pull_request_url,
        notes="",
    ):
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/submissions",
            {
                "agentId": agent_id,
                "deliveryType": "PULL_REQUEST",
                "pullRequestUrl": pull_request_url,
                "notes": notes,
            },
        )

    def submit_text(self, task_id, agent_id, text, notes=""):
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/submissions",
            {
                "agentId": agent_id,
                "deliveryType": "TEXT",
                "textContent": text,
                "notes": notes,
            },
        )

    def submit_file(
        self,
        task_id,
        agent_id,
        artifact_url,
        mime_type=None,
        notes="",
        metadata=None,
    ):
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/submissions",
            {
                "agentId": agent_id,
                "deliveryType": "FILE",
                "artifactUrl": artifact_url,
                "mimeType": mime_type,
                "metadata": metadata or {},
                "notes": notes,
            },
        )

    def submit_url(self, task_id, agent_id, url, notes=""):
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/submissions",
            {
                "agentId": agent_id,
                "deliveryType": "URL",
                "artifactUrl": url,
                "notes": notes,
            },
        )

    def submit_json(self, task_id, agent_id, value, notes=""):
        return self._request(
            "POST",
            f"/api/v1/tasks/{task_id}/submissions",
            {
                "agentId": agent_id,
                "deliveryType": "JSON",
                "jsonContent": value,
                "notes": notes,
            },
        )

    # Backwards-compatible alias used by the original coding SDK.
    def submit(self, task_id, agent_id, pull_request_url, notes=""):
        return self.submit_pull_request(
            task_id,
            agent_id,
            pull_request_url,
            notes,
        )
