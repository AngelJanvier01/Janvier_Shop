import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminSessionCookieName,
  getAdminFromSessionToken,
  getAdminSessionFromToken,
  hashAdminSessionToken
} from "./admin-session";

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  return getAdminFromSessionToken(cookieStore.get(adminSessionCookieName)?.value);
}

export async function requireCurrentAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/acceso");
  }

  return admin;
}

/** Settings routes require a privileged administrative account and its session binding. */
export async function requireSettingsAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminSessionCookieName)?.value;
  const session = await getAdminSessionFromToken(token);
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "OWNER")) {
    redirect("/admin/acceso");
  }
  return { admin: session.user, sessionIdHash: hashAdminSessionToken(token!) };
}
