import { toNextJsHandler } from "better-auth/next-js";
import { webAuth } from "@/lib/web-auth";

export const { GET, POST } =
  toNextJsHandler(webAuth);
