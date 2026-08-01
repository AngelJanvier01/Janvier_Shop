import { createHmac, timingSafeEqual } from "node:crypto";

export const proposalAccessCookieLifetimeSeconds = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.startsWith("replace-with-")) {
    throw new Error("AUTH_SECRET must be configured before sharing proposals.");
  }
  return value;
}

function signature(token: string, expiresAt: number) {
  return createHmac("sha256", secret())
    .update(`${token}.${expiresAt}`)
    .digest("base64url");
}

export function proposalAccessCookieName(token: string) {
  return `janvier_proposal_${createHmac("sha256", secret()).update(token).digest("hex").slice(0, 20)}`;
}

export function createProposalAccessCookie(token: string, inviteExpiresAt: Date) {
  const maximumExpiry =
    Math.floor(Date.now() / 1000) + proposalAccessCookieLifetimeSeconds;
  const expiresAt = Math.min(Math.floor(inviteExpiresAt.getTime() / 1000), maximumExpiry);
  return `${expiresAt}.${signature(token, expiresAt)}`;
}

export function verifyProposalAccessCookie(token: string, value: string | undefined) {
  const [expiresAtText, receivedSignature] = value?.split(".") ?? [];
  const expiresAt = Number(expiresAtText);
  if (
    !receivedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt * 1000 <= Date.now()
  ) {
    return false;
  }

  const expectedSignature = signature(token, expiresAt);
  const received = Buffer.from(receivedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
