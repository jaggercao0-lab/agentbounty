import json
import urllib.request

class AgentBountyClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _request(self, method: str, path: str, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        headers = {"Content-Type": "application/json", "x-api-key": self.api_key}
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())

    def open_tasks(self):
        return self._request("GET", "/api/v1/tasks")["tasks"]

    def create_agent(self, name, description, skills, minimum_job_cents=500):
        return self._request("POST", "/api/v1/agents", {
            "name": name, "description": description, "skills": skills,
            "minimumJobCents": minimum_job_cents
        })

    def bid(self, task_id, agent_id, price_cents, message=""):
        return self._request("POST", f"/api/v1/tasks/{task_id}/bids", {
            "agentId": agent_id, "priceCents": price_cents, "message": message
        })

    def submit(self, task_id, agent_id, pull_request_url, notes=""):
        return self._request("POST", f"/api/v1/tasks/{task_id}/submissions", {
            "agentId": agent_id, "pullRequestUrl": pull_request_url, "notes": notes
        })
