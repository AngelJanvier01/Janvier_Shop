CREATE TYPE "SicoddImportCandidateStatus" AS ENUM ('PENDING', 'IMPORTED', 'REJECTED');
CREATE TYPE "CommerceCartStatus" AS ENUM ('ACTIVE', 'QUOTE_REQUESTED', 'CLOSED');

ALTER TABLE "Product"
  ADD COLUMN "galleryUrls" JSONB,
  ADD COLUMN "partNumber" VARCHAR(160),
  ADD COLUMN "upc" VARCHAR(160),
  ADD COLUMN "warrantyYears" INTEGER,
  ADD COLUMN "stockTotal" INTEGER,
  ADD COLUMN "stockByLocation" JSONB,
  ADD COLUMN "supplierCostWithTax" DECIMAL(14,2),
  ADD COLUMN "basePriceWithTax" DECIMAL(14,2),
  ADD COLUMN "volumePrices" JSONB,
  ADD COLUMN "supplierSourceUrl" VARCHAR(2048),
  ADD COLUMN "supplierSourceKey" VARCHAR(160);

ALTER TABLE "SicoddImportCandidate"
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "status" "SicoddImportCandidateStatus" NOT NULL DEFAULT 'PENDING';

CREATE UNIQUE INDEX "SicoddImportCandidate_productId_key" ON "SicoddImportCandidate"("productId");
CREATE INDEX "SicoddImportCandidate_status_createdAt_idx" ON "SicoddImportCandidate"("status", "createdAt");
CREATE INDEX "Product_upc_idx" ON "Product"("upc");
CREATE INDEX "Product_partNumber_idx" ON "Product"("partNumber");

ALTER TABLE "SicoddImportCandidate"
  ADD CONSTRAINT "SicoddImportCandidate_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SicoddImportCandidate"
  ADD CONSTRAINT "SicoddImportCandidate_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommerceCart" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "status" "CommerceCartStatus" NOT NULL DEFAULT 'ACTIVE',
  "reference" VARCHAR(48),
  "requestedById" TEXT,
  "requestedAt" TIMESTAMP(3),
  "customerNotes" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommerceCart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceCartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommerceCartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceCart_reference_key" ON "CommerceCart"("reference");
CREATE INDEX "CommerceCart_accountId_status_updatedAt_idx" ON "CommerceCart"("accountId", "status", "updatedAt");
CREATE INDEX "CommerceCart_status_requestedAt_idx" ON "CommerceCart"("status", "requestedAt");
CREATE UNIQUE INDEX "CommerceCartItem_cartId_productId_key" ON "CommerceCartItem"("cartId", "productId");
CREATE INDEX "CommerceCartItem_productId_idx" ON "CommerceCartItem"("productId");

ALTER TABLE "CommerceCart"
  ADD CONSTRAINT "CommerceCart_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommerceCart"
  ADD CONSTRAINT "CommerceCart_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommerceCartItem"
  ADD CONSTRAINT "CommerceCartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "CommerceCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommerceCartItem"
  ADD CONSTRAINT "CommerceCartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
