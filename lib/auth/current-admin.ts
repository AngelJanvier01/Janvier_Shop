import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminSessionCookieName,
  getAdminFromSessionToken
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
