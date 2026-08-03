import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createProposalAccessCookie,
  proposalAccessCookieName,
  readProposalAccessCookieIdentity,
  verifyProposalAccessCookie
} from "../../lib/proposals/invite-access";

const previousSecret = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-for-proposal-invite-access";
});

afterEach(() => {
  if (previousSecret === undefined) {
    delete process.env.AUTH_SECRET;
    return;
  }
  process.env.AUTH_SECRET = previousSecret;
});

describe("proposal invite access", () => {
  it("firma una cookie de acceso limitada por la vigencia de la invitacion", () => {
    const token = "private-proposal-token";
    const cookie = createProposalAccessCookie(
      token,
      new Date(Date.now() + 60 * 60 * 1000)
    );

    expect(proposalAccessCookieName(token)).toMatch(/^janvier_proposal_[a-f0-9]{20}$/);
    expect(verifyProposalAccessCookie(token, cookie)).toBe(true);
    expect(readProposalAccessCookieIdentity(cookie)).toMatchObject({ token });
  });

  it("rechaza una cookie modificada, vencida o perteneciente a otro enlace", () => {
    const token = "private-proposal-token";
    const cookie = createProposalAccessCookie(
      token,
      new Date(Date.now() + 60 * 60 * 1000)
    );

    expect(verifyProposalAccessCookie("another-token", cookie)).toBe(false);
    expect(verifyProposalAccessCookie(token, `${cookie}modified`)).toBe(false);
    expect(verifyProposalAccessCookie(token, "1.invalid-signature")).toBe(false);
    expect(readProposalAccessCookieIdentity("1.invalid-signature")).toBeNull();
  });
});
