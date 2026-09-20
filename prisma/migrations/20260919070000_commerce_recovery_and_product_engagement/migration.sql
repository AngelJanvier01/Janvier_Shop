CREATE TYPE "CommerceCartRecoveryStatus" AS ENUM ('OPEN', 'CONTACTED', 'DISMISSED', 'CONVERTED');
CREATE TYPE "ProductEngagementEventType" AS ENUM ('PRODUCT_VIEW', 'GALLERY_COMPLETED', 'TECHNICAL_SHEET_VIEW', 'CART_ADDED');

CREATE TABLE "CommerceCartRecovery" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "status" "CommerceCartRecoveryStatus" NOT NULL DEFAULT 'OPEN',
  "adminNotes" VARCHAR(2000),
  "lastContactedAt" TIMESTAMP(3),
  "lastContactedById" TEXT,
  "dismissedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommerceCartRecovery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductEngagementEvent" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "accountId" TEXT,
  "customerUserId" TEXT,
  "eventType" "ProductEngagementEventType" NOT NULL,
  "sessionHash" CHAR(64),
  "galleryImageCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductEngagementEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceCartRecovery_cartId_key" ON "CommerceCartRecovery"("cartId");
CREATE INDEX "CommerceCartRecovery_status_updatedAt_idx" ON "CommerceCartRecovery"("status", "updatedAt");
CREATE INDEX "CommerceCartRecovery_lastContactedById_updatedAt_idx" ON "CommerceCartRecovery"("lastContactedById", "updatedAt");
CREATE INDEX "CommerceCart_status_updatedAt_idx" ON "CommerceCart"("status", "updatedAt");
CREATE INDEX "ProductEngagementEvent_productId_eventType_createdAt_idx" ON "ProductEngagementEvent"("productId", "eventType", "createdAt");
CREATE INDEX "ProductEngagementEvent_accountId_createdAt_idx" ON "ProductEngagementEvent"("accountId", "createdAt");
CREATE INDEX "ProductEngagementEvent_customerUserId_createdAt_idx" ON "ProductEngagementEvent"("customerUserId", "createdAt");
CREATE INDEX "ProductEngagementEvent_createdAt_idx" ON "ProductEngagementEvent"("createdAt");

ALTER TABLE "CommerceCartRecovery"
  ADD CONSTRAINT "CommerceCartRecovery_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "CommerceCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceCartRecovery"
  ADD CONSTRAINT "CommerceCartRecovery_lastContactedById_fkey"
  FOREIGN KEY ("lastContactedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductEngagementEvent"
  ADD CONSTRAINT "ProductEngagementEvent_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductEngagementEvent"
  ADD CONSTRAINT "ProductEngagementEvent_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductEngagementEvent"
  ADD CONSTRAINT "ProductEngagementEvent_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
