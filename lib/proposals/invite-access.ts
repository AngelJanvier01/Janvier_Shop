import { createHmac, timingSafeEqual } from "node:crypto";

export const proposalAccessCookieLifetimeSeconds = 60 * 60 * 24 * 7;

export type ProposalAccessCookieIdentity = {
  expiresAt: number;
  token: string;
};

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
  // The signed token stays in an HttpOnly cookie, allowing private asset
  // delivery to identify the active invitation without making assets public.
  return `${expiresAt}.${token}.${signature(token, expiresAt)}`;
}

export function verifyProposalAccessCookie(token: string, value: string | undefined) {
  const [expiresAtText, embeddedToken, thirdPart] = value?.split(".") ?? [];
  const scopedCookie = Boolean(thirdPart);
  const receivedSignature = scopedCookie ? thirdPart : embeddedToken;
  const expiresAt = Number(expiresAtText);
  if (
    !receivedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt * 1000 <= Date.now() ||
    (scopedCookie && embeddedToken !== token)
  ) {
    return false;
  }

  const expectedSignature = signature(token, expiresAt);
  const received = Buffer.from(receivedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Returns the invitation identity only when a scoped cookie is authentic. */
export function readProposalAccessCookieIdentity(
  value: string | undefined
): ProposalAccessCookieIdentity | null {
  const [expiresAtText, token, receivedSignature] = value?.split(".") ?? [];
  const expiresAt = Number(expiresAtText);
  if (
    !token ||
    !receivedSignature ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt * 1000 <= Date.now() ||
    !verifyProposalAccessCookie(token, value)
  ) {
    return null;
  }
  return { expiresAt, token };
}
