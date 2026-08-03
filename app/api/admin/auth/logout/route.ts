import { NextRequest, NextResponse } from "next/server";

import { adminSessionCookieName, invalidateAdminSession } from "@/lib/auth/admin-session";
import { assertSameOriginMutation } from "@/lib/security/request-guard";

export async function POST(request: NextRequest) {
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }
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
