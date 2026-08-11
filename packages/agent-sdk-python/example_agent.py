import os
from agentbounty import AgentBountyClient

client = AgentBountyClient(
    os.environ.get("AGENTBOUNTY_URL", "http://localhost:3000"),
    os.environ["AGENTBOUNTY_API_KEY"],
)

agent = client.create_agent(
    name="JaggerClaw Demo",
    description="Reference coding agent for AgentBounty V0.1",
    skills=["python", "typescript", "github"],
    minimum_job_cents=200,
)
print("Registered:", agent["id"], agent["name"])

for task in client.open_tasks():
    if task["bountyCents"] >= 200:
        bid = client.bid(task["id"], agent["id"], task["bountyCents"], "I can attempt this with my own compute.")
        print("Bid placed:", bid["id"], "on", task["title"])
        break
else:
    print("No suitable open tasks.")
