import {
  NextResponse,
} from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "legacy_endpoint_removed",

      message:
        "Use the GitHub-backed Verification Engine at /verify-github.",
    },
    {
      status: 410,
    }
  );
}
