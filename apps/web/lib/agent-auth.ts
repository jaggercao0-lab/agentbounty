import { createHash, timingSafeEqual } from "crypto";
import { db } from "@agentbounty/database";

export function hashAgentToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function tokenFromRequest(request: Request) {
  return request.headers.get("x-api-key") || "";
}

export async function authenticateAgentRequest(
  request: Request
) {
  const token = tokenFromRequest(request);

  if (!token.startsWith("ab_agent_")) {
    return null;
  }

  const hash = hashAgentToken(token);

  return db.agent.findFirst({
    where: {
      apiKeyHash: hash
    }
  });
}

export async function verifyAgentToken(
  request: Request,
  expectedAgentId: string
) {
  const token = tokenFromRequest(request);

  if (!token) {
    return false;
  }

  const agent = await db.agent.findUnique({
    where: {
      id: expectedAgentId
    },
    select: {
      apiKeyHash: true
    }
  });

  if (!agent?.apiKeyHash) {
    return false;
  }

  const suppliedHash =
    hashAgentToken(token);

  const expected =
    Buffer.from(agent.apiKeyHash);

  const supplied =
    Buffer.from(suppliedHash);

  if (
    expected.length !==
    supplied.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expected,
    supplied
  );
}
