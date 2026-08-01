import { describe, expect, it } from "vitest";

import {
  createProposalInviteCredentials,
  hashInviteToken,
  verifyProposalInviteCode
} from "../../lib/proposals/invite-security";

describe("proposal invite security", () => {
  it("crea secretos de invitación que sólo se pueden verificar mediante hashes", async () => {
    const invite = await createProposalInviteCredentials();

    expect(invite.token).toHaveLength(43);
    expect(invite.tokenHash).toBe(hashInviteToken(invite.token));
    expect(invite.accessCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(invite.accessCodeHash).not.toContain(invite.accessCode);
    await expect(
      verifyProposalInviteCode(invite.accessCode, invite.accessCodeHash)
    ).resolves.toBe(true);
  });

  it("normaliza el código y rechaza valores incorrectos o hashes inválidos", async () => {
    const invite = await createProposalInviteCredentials();

    await expect(
      verifyProposalInviteCode(invite.accessCode.toLowerCase(), invite.accessCodeHash)
    ).resolves.toBe(true);
    await expect(
      verifyProposalInviteCode("ZZZZ-ZZZZ", invite.accessCodeHash)
    ).resolves.toBe(false);
    await expect(verifyProposalInviteCode(invite.accessCode, "invalid")).resolves.toBe(
      false
    );
  });
});
