import { NextRequest, NextResponse } from "next/server";

import { adminSessionCookieName, invalidateAdminSession } from "@/lib/auth/admin-session";

export async function POST(request: NextRequest) {
  await invalidateAdminSession(request.cookies.get(adminSessionCookieName)?.value);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    name: adminSessionCookieName,
    path: "/",
    sameSite: "lax",
    value: ""
  });
  return response;
}
