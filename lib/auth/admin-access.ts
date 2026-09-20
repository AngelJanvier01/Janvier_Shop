import type { AdminRole } from "@/app/generated/prisma/client";

/** Roles allowed to open customer tax files, payment evidence and finance screens. */
export function isPrivilegedAdminRole(role: AdminRole) {
  return role === "ADMIN" || role === "OWNER";
}
