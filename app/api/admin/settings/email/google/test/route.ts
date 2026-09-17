import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AdminAuditEventType,
  EmailNotificationKind
} from "@/app/generated/prisma/client";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { getEmailConfiguration } from "@/lib/notifications/config";
import { createJanvierEmail, sanitizeEmailSubject } from "@/lib/notifications/templates";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const testInput = z.object({ recipient: z.string().email().max(320) });

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const { admin } = await requireSettingsAdmin();
  const rateError = assertRequestRate(
    request,
    admin.id,
    "google-oauth-test",
    3,
    15 * 60 * 60_000
  );
  if (rateError) return rateError;
  if (process.env.MAIL_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Bloqueado por MAIL_ENABLED=false." },
      { status: 409 }
    );
  }
  const parsed = testInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Destinatario inválido." }, { status: 400 });
  const recipient = parsed.data.recipient.trim().toLowerCase();
  const configuration = await database.notificationDeliveryConfiguration.findUnique({
    where: { installationKey: "default" }
  });
  const permitted = new Set(
    [
      configuration?.connectedAccountEmail,
      configuration?.adminRecipientEmail,
      admin.email
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
  );
  if (
    !configuration?.deliveryEnabled ||
    configuration.providerStatus !== "CONNECTED" ||
    !permitted.has(recipient)
  ) {
    return NextResponse.json(
      { error: "El destinatario o la entrega no están autorizados." },
      { status: 409 }
    );
  }
  const appUrl = getEmailConfiguration().appUrl;
  if (!appUrl)
    return NextResponse.json({ error: "APP_URL HTTPS es requerida." }, { status: 409 });
  const email = createJanvierEmail({
    actionLabel: "Abrir JANVIER",
    actionUrl: `${appUrl}/admin/ajustes/correo`,
    eyebrow: "test / google-gmail-api",
    summary:
      "Prueba controlada de la cola de JANVIER; no representa actividad comercial.",
    title: "Correo de prueba",
    tone: "signal"
  });
  const job = await database.emailOutbox.create({
    data: {
      dedupeKey: `gmail-test:${randomUUID()}`,
      html: email.html,
      kind: EmailNotificationKind.TEST,
      priority: 100,
      recipient,
      subject: sanitizeEmailSubject("JANVIER · Prueba de correo transaccional"),
      text: email.text
    }
  });
  await database.adminAuditEvent.create({
    data: { type: AdminAuditEventType.EMAIL_TEST_ENQUEUED, userId: admin.id }
  });
  return NextResponse.json(
    { enqueued: true, jobId: job.id },
    { status: 202, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
