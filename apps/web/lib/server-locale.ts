import { cookies } from "next/headers";

import {
  normalizeLocale,
  type Locale,
} from "@/lib/i18n";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();

  return normalizeLocale(
    cookieStore.get("agentbounty_locale")?.value
  );
}
