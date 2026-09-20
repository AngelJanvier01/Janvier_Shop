import { describe, expect, it } from "vitest";

import { isPrivilegedAdminRole } from "@/lib/auth/admin-access";

describe("sensitive administrative access", () => {
  it("allows only ADMIN and OWNER roles to open fiscal documents and payment evidence", () => {
    expect(isPrivilegedAdminRole("EDITOR")).toBe(false);
    expect(isPrivilegedAdminRole("ADMIN")).toBe(true);
    expect(isPrivilegedAdminRole("OWNER")).toBe(true);
  });
});
