ALTER TABLE "Product"
  ADD COLUMN "stockUpdatedAt" TIMESTAMP(3);

CREATE TABLE "SicoddWarehouse" (
  "id" TEXT NOT NULL,
  "sourceName" VARCHAR(160) NOT NULL,
  "normalizedName" VARCHAR(160) NOT NULL,
  "nickname" VARCHAR(100) NOT NULL,
  "notes" VARCHAR(500),
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SicoddWarehouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SicoddWarehouse_normalizedName_key"
  ON "SicoddWarehouse"("normalizedName");
CREATE INDEX "SicoddWarehouse_lastSeenAt_idx"
  ON "SicoddWarehouse"("lastSeenAt");
CREATE INDEX "Product_supplierSourceKey_idx"
  ON "Product"("supplierSourceKey");

UPDATE "SicoddSyncSettings"
SET "includeExternalWarehouses" = true;
