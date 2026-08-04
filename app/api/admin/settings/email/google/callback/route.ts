import { NextResponse } from "next/server";

import {
  AdminAuditEventType,
  NotificationDeliveryProvider,
  NotificationDeliveryProviderStatus
} from "@/app/generated/prisma/client";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { encryptedSettingsVault } from "@/lib/settings/encrypted-settings-vault";
import { isAllowedGoogleAccount } from "@/lib/settings/delivery-settings";
import { googleOAuthAdapter } from "@/lib/settings/google-oauth-adapter";
import {
  consumeGoogleOAuthAttempt,
  failGoogleOAuthAttempt,
  safeEmailSettingsReturnPath
} from "@/lib/settings/google-oauth-state";
import { googleOAuthScopes } from "@/lib/settings/google-oauth-config";

export const dynamic = "force-dynamic";

function callbackRedirect(
  request: Request,
  result: string,
  returnPath = "/admin/ajustes/correo"
) {
  const url = new URL(safeEmailSettingsReturnPath(returnPath), request.url);
  url.searchParams.set("google", result);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const state = parameters.get("state");
  const providerError = parameters.get("error");
  const { admin, sessionIdHash } = await requireSettingsAdmin();
  if (!state || state.length > 512) {
    await database.adminAuditEvent.create({
      data: { type: AdminAuditEventType.GOOGLE_OAUTH_CALLBACK_REJECTED, userId: admin.id }
    });
    return callbackRedirect(request, "rejected");
  }
  const attempt = await consumeGoogleOAuthAttempt({
    adminId: admin.id,
    sessionIdHash,
    state
  });
  if (!attempt) {
    await database.adminAuditEvent.create({
      data: { type: AdminAuditEventType.GOOGLE_OAUTH_CALLBACK_REJECTED, userId: admin.id }
    });
    return callbackRedirect(request, "rejected");
  }
  if (providerError) {
    await failGoogleOAuthAttempt(state, "GOOGLE_CANCELLED");
    await database.adminAuditEvent.create({
      data: { type: AdminAuditEventType.GOOGLE_OAUTH_CONNECT_FAILED, userId: admin.id }
    });
    return callbackRedirect(request, "cancelled", attempt.returnPath);
  }
  const code = parameters.get("code");
  if (!code || code.length > 4096) {
    await failGoogleOAuthAttempt(state, "GOOGLE_CODE_MISSING");
    await database.adminAuditEvent.create({
      data: { type: AdminAuditEventType.GOOGLE_OAUTH_CONNECT_FAILED, userId: admin.id }
    });
    return callbackRedirect(request, "failed", attempt.returnPath);
  }
  try {
    const exchange = await googleOAuthAdapter.exchangeAuthorizationCode(code);
    const identity = await googleOAuthAdapter.verifyIdentity(exchange.idToken);
    const requiredScopes = new Set(googleOAuthScopes);
    if (
      !exchange.refreshToken ||
      !identity.emailVerified ||
      !isAllowedGoogleAccount(identity.email) ||
      ![...requiredScopes].every((scope) => exchange.scopes.includes(scope))
    ) {
      throw new Error("GOOGLE_CONNECTION_REJECTED");
    }
    const configuration = await database.notificationDeliveryConfiguration.upsert({
      create: {
        connectedByAdminId: admin.id,
        provider: NotificationDeliveryProvider.GMAIL_API,
        providerStatus: NotificationDeliveryProviderStatus.CONNECTING,
        updatedByAdminId: admin.id
      },
      update: {
        provider: NotificationDeliveryProvider.GMAIL_API,
        providerStatus: NotificationDeliveryProviderStatus.CONNECTING,
        updatedByAdminId: admin.id
      },
      where: { installationKey: "default" }
    });
    const encryptedRefreshToken = encryptedSettingsVault.encrypt(exchange.refreshToken, {
      fieldName: "refreshToken",
      provider: NotificationDeliveryProvider.GMAIL_API,
      recordId: configuration.id
    });
    await database.$transaction([
      database.notificationDeliveryConfiguration.update({
        data: {
          configurationVersion: { increment: 1 },
          connectedAccountEmail: identity.email,
          connectedAccountName: identity.name,
          connectedByAdminId: admin.id,
          deliveryEnabled: false,
          disconnectedAt: null,
          encryptedRefreshToken,
          encryptionVersion: encryptedSettingsVault.version,
          grantedScopes: exchange.scopes,
          lastConnectedAt: new Date(),
          lastFailureAt: null,
          lastFailureCode: null,
          provider: NotificationDeliveryProvider.GMAIL_API,
          providerStatus: NotificationDeliveryProviderStatus.CONNECTED,
          senderEmail: identity.email,
          adminRecipientEmail: admin.email,
          updatedByAdminId: admin.id
        },
        where: { id: configuration.id }
      }),
      database.adminAuditEvent.create({
        data: { type: AdminAuditEventType.GOOGLE_OAUTH_CONNECTED, userId: admin.id }
      })
    ]);
    return callbackRedirect(request, "connected", attempt.returnPath);
  } catch {
    await failGoogleOAuthAttempt(state, "GOOGLE_CONNECTION_FAILED");
    await database.notificationDeliveryConfiguration.updateMany({
      data: {
        lastFailureAt: new Date(),
        lastFailureCode: "GOOGLE_CONNECTION_FAILED",
        providerStatus: NotificationDeliveryProviderStatus.ERROR
      },
      where: {
        installationKey: "default",
        provider: NotificationDeliveryProvider.GMAIL_API
      }
    });
    await database.adminAuditEvent.create({
      data: { type: AdminAuditEventType.GOOGLE_OAUTH_CONNECT_FAILED, userId: admin.id }
    });
    return callbackRedirect(request, "failed", attempt.returnPath);
  }
}
