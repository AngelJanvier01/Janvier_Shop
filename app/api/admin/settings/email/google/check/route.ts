import { NextResponse } from "next/server";

import {
  AdminAuditEventType,
  NotificationDeliveryProviderStatus
} from "@/app/generated/prisma/client";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { GmailApiDeliveryProvider } from "@/lib/notifications/delivery-provider";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const { admin } = await requireSettingsAdmin();
  const rateError = assertRequestRate(
    request,
    admin.id,
    "google-oauth-check",
    10,
    15 * 60_000
  );
  if (rateError) return rateError;
  const configuration = await database.notificationDeliveryConfiguration.findUnique({
    where: { installationKey: "default" }
  });
  if (!configuration?.encryptedRefreshToken || configuration.provider !== "GMAIL_API") {
    return NextResponse.json(
      { error: "No hay una conexión de Gmail disponible." },
      { status: 409 }
    );
  }
  const startedAt = Date.now();
  const result = await new GmailApiDeliveryProvider(configuration).checkConnection();
  await database.$transaction([
    database.notificationDeliveryConfiguration.update({
      data: {
        lastCheckedAt: new Date(),
        lastFailureAt: result.ok ? null : new Date(),
        lastFailureCode: result.ok ? null : (result.code ?? "GOOGLE_CHECK_FAILED"),
        providerStatus: result.ok
          ? NotificationDeliveryProviderStatus.CONNECTED
          : NotificationDeliveryProviderStatus.DEGRADED
      },
      where: { id: configuration.id }
    }),
    database.adminAuditEvent.create({
      data: {
        type: AdminAuditEventType.GOOGLE_OAUTH_CONNECTION_CHECKED,
        userId: admin.id
      }
    })
  ]);
  return NextResponse.json(
    { durationMs: Date.now() - startedAt, ok: result.ok },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
