import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { SmtpDeliveryProvider } from "@/lib/notifications/delivery-provider";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const { admin } = await requireSettingsAdmin();
  const rateError = await assertRequestRate(
    request,
    admin.id,
    "smtp-check",
    5,
    15 * 60_000
  );
  if (rateError) return rateError;

  const result = await new SmtpDeliveryProvider().checkConnection();
  if (!result.ok) {
    return NextResponse.json(
      { error: `No se pudo comprobar SMTP (${result.code ?? "SMTP_ERROR"}).` },
      { status: 409 }
    );
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
