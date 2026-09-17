CREATE TYPE "CustomerAccountStatus" AS ENUM (
  'PENDING_EMAIL',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

CREATE TYPE "CustomerUserRole" AS ENUM ('OWNER', 'BUYER', 'VIEWER');

CREATE TYPE "CustomerPurchaseVolume" AS ENUM (
  'PERSONAL',
  'OCCASIONAL',
  'REGULAR',
  'PROJECTS',
  'ENTERPRISE'
);

CREATE TYPE "CustomerEmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "CustomerAccount" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "reviewedById" TEXT,
  "companyName" VARCHAR(160) NOT NULL,
  "taxId" VARCHAR(24),
  "contactName" VARCHAR(160) NOT NULL,
  "contactRole" VARCHAR(120),
  "contactPhone" VARCHAR(48),
  "purchaseVolume" "CustomerPurchaseVolume" NOT NULL DEFAULT 'OCCASIONAL',
  "purchaseIntent" VARCHAR(2000),
  "status" "CustomerAccountStatus" NOT NULL DEFAULT 'PENDING_EMAIL',
  "priceListCode" VARCHAR(80),
  "commercialDiscountPct" DECIMAL(9,4),
  "reviewNotes" VARCHAR(4000),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerUser" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "passwordHash" TEXT,
  "role" "CustomerUserRole" NOT NULL DEFAULT 'OWNER',
  "emailVerifiedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerEmailVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerEmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerEmailDelivery" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "status" "CustomerEmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failureSummary" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAccount_clientId_key" ON "CustomerAccount"("clientId");
CREATE INDEX "CustomerAccount_status_updatedAt_idx" ON "CustomerAccount"("status", "updatedAt");
CREATE INDEX "CustomerAccount_companyName_idx" ON "CustomerAccount"("companyName");
CREATE INDEX "CustomerAccount_taxId_idx" ON "CustomerAccount"("taxId");

CREATE UNIQUE INDEX "CustomerUser_email_key" ON "CustomerUser"("email");
CREATE INDEX "CustomerUser_accountId_isActive_idx" ON "CustomerUser"("accountId", "isActive");

CREATE UNIQUE INDEX "CustomerEmailVerification_tokenHash_key" ON "CustomerEmailVerification"("tokenHash");
CREATE INDEX "CustomerEmailVerification_userId_expiresAt_idx" ON "CustomerEmailVerification"("userId", "expiresAt");
CREATE INDEX "CustomerEmailVerification_expiresAt_idx" ON "CustomerEmailVerification"("expiresAt");

CREATE INDEX "CustomerEmailDelivery_status_createdAt_idx" ON "CustomerEmailDelivery"("status", "createdAt");

CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_userId_expiresAt_idx" ON "CustomerSession"("userId", "expiresAt");
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");

ALTER TABLE "CustomerAccount"
  ADD CONSTRAINT "CustomerAccount_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerAccount"
  ADD CONSTRAINT "CustomerAccount_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerUser"
  ADD CONSTRAINT "CustomerUser_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerEmailVerification"
  ADD CONSTRAINT "CustomerEmailVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "CustomerUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerEmailDelivery"
  ADD CONSTRAINT "CustomerEmailDelivery_verificationId_fkey"
  FOREIGN KEY ("verificationId") REFERENCES "CustomerEmailVerification"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerSession"
  ADD CONSTRAINT "CustomerSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "CustomerUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
