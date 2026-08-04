import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { encryptedSettingsVault } from "@/lib/settings/encrypted-settings-vault";
import { disconnectGoogleDelivery } from "@/lib/settings/delivery-settings";
import { googleOAuthAdapter } from "@/lib/settings/google-oauth-adapter";
import { verifyPassword } from "@/lib/security/password";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const disconnectInput = z.object({
  confirmation: z.literal("DESCONECTAR"),
  configurationVersion: z.number().int().positive(),
  currentPassword: z.string().min(1).max(256)
});

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const { admin } = await requireSettingsAdmin();
  const rateError = assertRequestRate(
    request,
    admin.id,
    "google-oauth-disconnect",
    5,
    15 * 60_000
  );
  if (rateError) return rateError;
  const parsed = disconnectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Confirmación inválida." }, { status: 400 });
  if (!(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
    return NextResponse.json(
      { error: "La contraseña actual no es correcta." },
      { status: 403 }
    );
  }
  const configuration = await database.notificationDeliveryConfiguration.findUnique({
    where: { installationKey: "default" }
  });
  if (!configuration?.encryptedRefreshToken) {
    return NextResponse.json(
      { error: "No existe una conexión activa." },
      { status: 409 }
    );
  }
  let remoteWarning = false;
  try {
    const refreshToken = encryptedSettingsVault.decrypt(
      configuration.encryptedRefreshToken,
      {
        fieldName: "refreshToken",
        provider: configuration.provider,
        recordId: configuration.id
      }
    );
    await googleOAuthAdapter.revokeToken(refreshToken);
  } catch {
    remoteWarning = true;
  }
  const disconnected = await disconnectGoogleDelivery({
    adminId: admin.id,
    expectedVersion: parsed.data.configurationVersion
  });
  if (!disconnected) {
    return NextResponse.json(
      { error: "La configuración cambió. Recarga la página." },
      { status: 409 }
    );
  }
  return NextResponse.json(
    { ok: true, remoteWarning },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
