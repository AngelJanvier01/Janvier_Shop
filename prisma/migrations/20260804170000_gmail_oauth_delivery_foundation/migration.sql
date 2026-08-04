-- v2.0.2: Gmail OAuth delivery settings. Defaults intentionally keep delivery off.
CREATE TYPE "NotificationDeliveryProvider" AS ENUM ('DISABLED', 'GMAIL_API', 'SMTP_LEGACY');
CREATE TYPE "NotificationDeliveryProviderStatus" AS ENUM (
  'NOT_CONFIGURED', 'READY_TO_CONNECT', 'CONNECTING', 'CONNECTED', 'DEGRADED',
  'EXPIRED', 'REVOKED', 'DISCONNECTED', 'ERROR'
);

ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_SETTINGS_OPENED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_CONNECT_STARTED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_CONNECTED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_CONNECT_FAILED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_CALLBACK_REJECTED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_CONNECTION_CHECKED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_RECONNECTED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'GOOGLE_OAUTH_DISCONNECTED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_SENDER_UPDATED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_PREFERENCES_UPDATED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_DELIVERY_ENABLED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_DELIVERY_DISABLED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_TEST_PREVIEWED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'EMAIL_TEST_ENQUEUED';

CREATE TABLE "NotificationDeliveryConfiguration" (
  "id" TEXT NOT NULL,
  "installationKey" VARCHAR(32) NOT NULL DEFAULT 'default',
  "provider" "NotificationDeliveryProvider" NOT NULL DEFAULT 'DISABLED',
  "providerStatus" "NotificationDeliveryProviderStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "connectedAccountEmail" VARCHAR(320),
  "connectedAccountName" VARCHAR(255),
  "encryptedRefreshToken" TEXT,
  "encryptionVersion" INTEGER,
  "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "senderName" VARCHAR(160),
  "senderEmail" VARCHAR(320),
  "replyToEmail" VARCHAR(320),
  "adminRecipientEmail" VARCHAR(320),
  "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastConnectedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "lastSuccessfulTokenRefreshAt" TIMESTAMP(3),
  "lastSuccessfulSendAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "lastFailureCode" VARCHAR(96),
  "connectedByAdminId" TEXT,
  "updatedByAdminId" TEXT,
  "configurationVersion" INTEGER NOT NULL DEFAULT 1,
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDeliveryConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDeliveryConfiguration_installationKey_key"
  ON "NotificationDeliveryConfiguration"("installationKey");
ALTER TABLE "NotificationDeliveryConfiguration"
  ADD CONSTRAINT "NotificationDeliveryConfiguration_connectedByAdminId_fkey"
  FOREIGN KEY ("connectedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryConfiguration"
  ADD CONSTRAINT "NotificationDeliveryConfiguration_updatedByAdminId_fkey"
  FOREIGN KEY ("updatedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GoogleOAuthAuthorizationAttempt" (
  "id" TEXT NOT NULL,
  "stateHash" CHAR(64) NOT NULL,
  "adminId" TEXT NOT NULL,
  "sessionIdHash" CHAR(43) NOT NULL,
  "returnPath" VARCHAR(240) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "failureCode" VARCHAR(96),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleOAuthAuthorizationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleOAuthAuthorizationAttempt_stateHash_key"
  ON "GoogleOAuthAuthorizationAttempt"("stateHash");
CREATE INDEX "GoogleOAuthAuthorizationAttempt_expiresAt_idx"
  ON "GoogleOAuthAuthorizationAttempt"("expiresAt");
CREATE INDEX "GoogleOAuthAuthorizationAttempt_adminId_createdAt_idx"
  ON "GoogleOAuthAuthorizationAttempt"("adminId", "createdAt");
ALTER TABLE "GoogleOAuthAuthorizationAttempt"
  ADD CONSTRAINT "GoogleOAuthAuthorizationAttempt_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
