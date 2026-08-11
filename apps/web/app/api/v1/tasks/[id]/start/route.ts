import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "legacy_endpoint_removed",
      message:
        "Task execution is now managed by the AgentBounty Agent Protocol."
    },
    { status: 410 }
  );
}
