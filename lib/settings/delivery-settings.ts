import {
  AdminAuditEventType,
  NotificationDeliveryProvider,
  NotificationDeliveryProviderStatus
} from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { getEmailConfiguration } from "../notifications/config";
import { getGoogleOAuthBootstrap } from "./google-oauth-config";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function isAllowedGoogleAccount(email: string) {
  const bootstrap = getGoogleOAuthBootstrap();
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";
  return (
    (!bootstrap.allowedEmail || normalized === bootstrap.allowedEmail) &&
    (!bootstrap.allowedDomain || domain === bootstrap.allowedDomain)
  );
}

export function maskEmail(email: string | null) {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  return `${local?.slice(0, 1) ?? "•"}••••@${domain ?? ""}`;
}

export async function getDeliveryConfiguration() {
  return database.notificationDeliveryConfiguration.findUnique({
    where: { installationKey: "default" }
  });
}

export async function getDeliverySettingsView() {
  const [configuration, bootstrap] = await Promise.all([
    getDeliveryConfiguration(),
    Promise.resolve(getGoogleOAuthBootstrap())
  ]);
  const legacy = getEmailConfiguration();
  return {
    bootstrap: {
      allowedAccount: bootstrap.allowedEmail || bootstrap.allowedDomain || null,
      clientId: bootstrap.clientIdConfigured ? "CONFIGURADO" : "FALTANTE",
      clientSecret: bootstrap.clientSecretConfigured ? "CONFIGURADO" : "FALTANTE",
      encryptionKey: bootstrap.encryptionKeyConfigured ? "CONFIGURADA" : "FALTANTE",
      publishingStatus: bootstrap.publishingStatus,
      redirectUri: bootstrap.redirectUriValid
        ? bootstrap.redirectUri
        : "FALTANTE O INVÁLIDA"
    },
    configuration: configuration
      ? {
          account: maskEmail(configuration.connectedAccountEmail),
          configurationVersion: configuration.configurationVersion,
          deliveryEnabled: configuration.deliveryEnabled,
          grantedScopes: configuration.grantedScopes,
          lastCheckedAt: configuration.lastCheckedAt?.toISOString() ?? null,
          lastConnectedAt: configuration.lastConnectedAt?.toISOString() ?? null,
          lastSuccessfulSendAt: configuration.lastSuccessfulSendAt?.toISOString() ?? null,
          provider: configuration.provider,
          providerStatus: configuration.providerStatus
        }
      : null,
    legacySmtpAvailable: legacy.isConfigured,
    mailEnabled: legacy.isEnabled
  };
}

export async function saveGoogleConnection(input: {
  accountEmail: string;
  accountName: string | null;
  adminId: string;
  encryptedRefreshToken: string;
  scopes: string[];
}) {
  const now = new Date();
  return database.$transaction(async (transaction) => {
    const previous = await transaction.notificationDeliveryConfiguration.findUnique({
      where: { installationKey: "default" }
    });
    const configuration = await transaction.notificationDeliveryConfiguration.upsert({
      create: {
        connectedAccountEmail: input.accountEmail,
        connectedAccountName: input.accountName,
        connectedByAdminId: input.adminId,
        deliveryEnabled: false,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptionVersion: 1,
        grantedScopes: input.scopes,
        lastConnectedAt: now,
        provider: NotificationDeliveryProvider.GMAIL_API,
        providerStatus: NotificationDeliveryProviderStatus.CONNECTED,
        senderEmail: input.accountEmail,
        updatedByAdminId: input.adminId
      },
      update: {
        connectedAccountEmail: input.accountEmail,
        connectedAccountName: input.accountName,
        connectedByAdminId: input.adminId,
        configurationVersion: { increment: 1 },
        deliveryEnabled: false,
        disconnectedAt: null,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptionVersion: 1,
        grantedScopes: input.scopes,
        lastConnectedAt: now,
        lastFailureAt: null,
        lastFailureCode: null,
        provider: NotificationDeliveryProvider.GMAIL_API,
        providerStatus: NotificationDeliveryProviderStatus.CONNECTED,
        senderEmail: input.accountEmail,
        updatedByAdminId: input.adminId
      },
      where: { installationKey: "default" }
    });
    await transaction.adminAuditEvent.create({
      data: {
        type: previous
          ? AdminAuditEventType.GOOGLE_OAUTH_RECONNECTED
          : AdminAuditEventType.GOOGLE_OAUTH_CONNECTED,
        userId: input.adminId
      }
    });
    return configuration;
  });
}

export async function disconnectGoogleDelivery(input: {
  adminId: string;
  expectedVersion: number;
}) {
  const result = await database.notificationDeliveryConfiguration.updateMany({
    data: {
      configurationVersion: { increment: 1 },
      connectedAccountEmail: null,
      connectedAccountName: null,
      disconnectedAt: new Date(),
      deliveryEnabled: false,
      encryptedRefreshToken: null,
      encryptionVersion: null,
      grantedScopes: [],
      providerStatus: NotificationDeliveryProviderStatus.DISCONNECTED,
      updatedByAdminId: input.adminId
    },
    where: {
      configurationVersion: input.expectedVersion,
      installationKey: "default",
      provider: NotificationDeliveryProvider.GMAIL_API
    }
  });
  if (!result.count) return false;
  await database.adminAuditEvent.create({
    data: { type: AdminAuditEventType.GOOGLE_OAUTH_DISCONNECTED, userId: input.adminId }
  });
  return true;
}

export function isSafeReplyTo(value: string | null | undefined) {
  return Boolean(value && !/[\r\n]/u.test(value) && emailPattern.test(value.trim()));
}
