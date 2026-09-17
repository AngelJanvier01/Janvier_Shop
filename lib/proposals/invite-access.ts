import { createHmac, timingSafeEqual } from "node:crypto";

export const proposalAccessCookieLifetimeSeconds = 60 * 60 * 24 * 7;

export type ProposalAccessCookieIdentity = {
  expiresAt: number;
  token: string;
  viewerId: string;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.startsWith("replace-with-")) {
    throw new Error("AUTH_SECRET must be configured before sharing proposals.");
  }
  return value;
}

function signature(token: string, expiresAt: number, viewerId: string) {
  return createHmac("sha256", secret())
    .update(`${token}.${expiresAt}.${viewerId}`)
    .digest("base64url");
}

export function proposalAccessCookieName(token: string) {
  return `janvier_proposal_${createHmac("sha256", secret()).update(token).digest("hex").slice(0, 20)}`;
}

export function createProposalAccessCookie(
  token: string,
  inviteExpiresAt: Date,
  viewerId: string
) {
  const maximumExpiry =
    Math.floor(Date.now() / 1000) + proposalAccessCookieLifetimeSeconds;
  const expiresAt = Math.min(Math.floor(inviteExpiresAt.getTime() / 1000), maximumExpiry);
  // The signed token stays in an HttpOnly cookie, allowing private asset
  // delivery to identify the active invitation without making assets public.
  return `${expiresAt}.${token}.${viewerId}.${signature(token, expiresAt, viewerId)}`;
}

export function verifyProposalAccessCookie(token: string, value: string | undefined) {
  const [expiresAtText, embeddedToken, viewerId, receivedSignature] =
    value?.split(".") ?? [];
  const expiresAt = Number(expiresAtText);
  if (
    !viewerId ||
    !receivedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt * 1000 <= Date.now() ||
    embeddedToken !== token
  ) {
    return false;
  }

  const expectedSignature = signature(token, expiresAt, viewerId);
  const received = Buffer.from(receivedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Returns the invitation identity only when a scoped cookie is authentic. */
export function readProposalAccessCookieIdentity(
  value: string | undefined
): ProposalAccessCookieIdentity | null {
  const [expiresAtText, token, viewerId, receivedSignature] = value?.split(".") ?? [];
  const expiresAt = Number(expiresAtText);
  if (
    !token ||
    !viewerId ||
    !receivedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt * 1000 <= Date.now() ||
    !verifyProposalAccessCookie(token, value)
  ) {
    return null;
  }
  return { expiresAt, token, viewerId };
}
