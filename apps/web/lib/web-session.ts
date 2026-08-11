import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { webAuth } from "@/lib/web-auth";

export async function getWebSession() {
  return webAuth.api.getSession({
    headers: await headers(),
  });
}

export async function requireWebUser() {
  const session = await getWebSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}
