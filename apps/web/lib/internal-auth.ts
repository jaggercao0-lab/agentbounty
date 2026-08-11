import {
  createHash,
  timingSafeEqual,
} from "crypto";

function digest(value: string) {
  return createHash("sha256")
    .update(value)
    .digest();
}

export function verifyInternalRequest(
  request: Request
) {
  const expected =
    process.env.AGENTBOUNTY_INTERNAL_KEY;

  const supplied =
    request.headers.get(
      "x-internal-key"
    );

  if (!expected || !supplied) {
    return false;
  }

  const a = digest(expected);
  const b = digest(supplied);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
