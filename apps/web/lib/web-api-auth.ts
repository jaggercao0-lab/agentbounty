import { webAuth } from "@/lib/web-auth";

export async function authenticateWebRequest(
  request: Request
) {
  const session = await webAuth.api.getSession({
    headers: request.headers,
  });

  return session?.user ?? null;
}
