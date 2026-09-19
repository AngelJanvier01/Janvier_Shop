CREATE TYPE "CommerceOrderStatus" AS ENUM (
  'REQUESTED',
  'REVIEWING',
  'CONFIRMED',
  'FULFILLED',
  'CANCELLED'
);

CREATE TABLE "CommerceOrder" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sourceQuoteId" TEXT,
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "reference" VARCHAR(48) NOT NULL,
  "status" "CommerceOrderStatus" NOT NULL DEFAULT 'REQUESTED',
  "customerNotes" VARCHAR(2000),
  "adminNotes" VARCHAR(4000),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "snapshotName" TEXT,
  "snapshotSku" VARCHAR(80),
  "snapshotBrand" VARCHAR(100),
  "snapshotUnitPriceWithTax" DECIMAL(14, 2),
  "snapshotDiscountPct" DECIMAL(9, 4),
  "snapshotStockTotal" INTEGER,
  "snapshotAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommerceOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceOrder_sourceQuoteId_key" ON "CommerceOrder"("sourceQuoteId");
CREATE UNIQUE INDEX "CommerceOrder_reference_key" ON "CommerceOrder"("reference");
CREATE INDEX "CommerceOrder_accountId_status_updatedAt_idx"
  ON "CommerceOrder"("accountId", "status", "updatedAt");
CREATE INDEX "CommerceOrder_status_requestedAt_idx"
  ON "CommerceOrder"("status", "requestedAt");
CREATE INDEX "CommerceOrder_requestedById_idx" ON "CommerceOrder"("requestedById");
CREATE UNIQUE INDEX "CommerceOrderItem_orderId_productId_key"
  ON "CommerceOrderItem"("orderId", "productId");
CREATE INDEX "CommerceOrderItem_productId_idx" ON "CommerceOrderItem"("productId");

ALTER TABLE "CommerceOrder"
  ADD CONSTRAINT "CommerceOrder_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder"
  ADD CONSTRAINT "CommerceOrder_sourceQuoteId_fkey"
  FOREIGN KEY ("sourceQuoteId") REFERENCES "CommerceCart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder"
  ADD CONSTRAINT "CommerceOrder_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrder"
  ADD CONSTRAINT "CommerceOrder_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderItem"
  ADD CONSTRAINT "CommerceOrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommerceOrderItem"
  ADD CONSTRAINT "CommerceOrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
