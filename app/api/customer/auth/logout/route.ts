import { NextRequest, NextResponse } from "next/server";

import {
  customerSessionCookieName,
  invalidateCustomerSession
} from "@/lib/auth/customer-session";
import { assertSameOriginMutation } from "@/lib/security/request-guard";

export async function POST(request: NextRequest) {
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }
  await invalidateCustomerSession(request.cookies.get(customerSessionCookieName)?.value);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    name: customerSessionCookieName,
    path: "/",
    sameSite: "lax",
    value: ""
  });
  return response;
}
