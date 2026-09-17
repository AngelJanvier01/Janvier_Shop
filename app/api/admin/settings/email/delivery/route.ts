import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AdminAuditEventType,
  NotificationDeliveryProvider,
  NotificationDeliveryProviderStatus
} from "@/app/generated/prisma/client";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const updateInput = z.object({
  configurationVersion: z.number().int().positive(),
  deliveryEnabled: z.boolean()
});

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const { admin } = await requireSettingsAdmin();
  const rateError = assertRequestRate(
    request,
    admin.id,
    "email-delivery-preference",
    10,
    15 * 60_000
  );
  if (rateError) return rateError;
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Preferencia inválida." }, { status: 400 });
  if (parsed.data.deliveryEnabled && process.env.MAIL_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Bloqueado por MAIL_ENABLED=false." },
      { status: 409 }
    );
  }
  const current = await database.notificationDeliveryConfiguration.findUnique({
    where: { installationKey: "default" }
  });
  if (
    !current ||
    current.provider !== NotificationDeliveryProvider.GMAIL_API ||
    current.providerStatus !== NotificationDeliveryProviderStatus.CONNECTED ||
    !current.encryptedRefreshToken ||
    !current.senderEmail ||
    !current.adminRecipientEmail
  ) {
    return NextResponse.json(
      { error: "La conexión de Gmail aún no está lista." },
      { status: 409 }
    );
  }
  const updated = await database.notificationDeliveryConfiguration.updateMany({
    data: {
      configurationVersion: { increment: 1 },
      deliveryEnabled: parsed.data.deliveryEnabled,
      updatedByAdminId: admin.id
    },
    where: { configurationVersion: parsed.data.configurationVersion, id: current.id }
  });
  if (!updated.count) {
    return NextResponse.json(
      { error: "La configuración cambió. Recarga la página." },
      { status: 409 }
    );
  }
  await database.adminAuditEvent.create({
    data: {
      type: parsed.data.deliveryEnabled
        ? AdminAuditEventType.EMAIL_DELIVERY_ENABLED
        : AdminAuditEventType.EMAIL_DELIVERY_DISABLED,
      userId: admin.id
    }
  });
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
