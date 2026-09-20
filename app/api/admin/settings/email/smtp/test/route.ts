import { randomUUID } from "node:crypto";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { dispatchPendingEmails } from "@/lib/notifications/dispatch";
import { queueRecipientEmail } from "@/lib/notifications/outbox";
import { createJanvierEmail } from "@/lib/notifications/templates";
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
    "smtp-test",
    3,
    15 * 60_000
  );
  if (rateError) return rateError;

  const dedupeKey = `smtp-test:${randomUUID()}`;
  const message = createJanvierEmail({
    eyebrow: "test / smtp_app_password",
    summary:
      "La conexión SMTP y la cola transaccional de JANVIER entregaron esta prueba.",
    title: "Correo SMTP funcionando",
    tone: "signal"
  });
  const queued = await queueRecipientEmail({
    dedupeKey,
    html: message.html,
    kind: EmailNotificationKind.TEST,
    priority: 100,
    recipient: admin.email,
    subject: "JANVIER · Prueba SMTP",
    text: message.text
  });
  if (!queued.queued) {
    return NextResponse.json(
      { error: "SMTP todavía no está habilitado o le faltan variables." },
      { status: 409 }
    );
  }

  const delivery = await dispatchPendingEmails(1, dedupeKey);
  if (!delivery.sent) {
    return NextResponse.json(
      { error: "La prueba quedó en cola, pero el proveedor no confirmó el envío." },
      { status: 503 }
    );
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
