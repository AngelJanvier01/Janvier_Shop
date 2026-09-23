import { NextRequest, NextResponse } from "next/server";

import {
  customerSessionCookieName,
  getCustomerFromSessionToken
} from "@/lib/auth/customer-session";
import { assertSameOriginMutation } from "@/lib/security/request-guard";

export async function POST(request: NextRequest) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;

  const customer = await getCustomerFromSessionToken(
    request.cookies.get(customerSessionCookieName)?.value
  );
  if (!customer) {
    return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  }
  return new NextResponse(null, {
    headers: { "Cache-Control": "private, no-store" },
    status: 204
  });
}
