import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../../lib/security/password";

describe("password security", () => {
  it("hashes and verifies an allowed password", async () => {
    const password = "JANVIER / A strong local password";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt-v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("not the password", hash)).resolves.toBe(false);
  });

  it("rejects weak and malformed password values", async () => {
    await expect(hashPassword("short")).rejects.toThrow("Passwords must contain");
    await expect(verifyPassword("something", "not-a-password-hash")).resolves.toBe(false);
  });
});
