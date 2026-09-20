CREATE TYPE "SicoddSyncRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "SicoddSyncProductResult" AS ENUM ('CREATED', 'UPDATED', 'UNCHANGED', 'SKIPPED', 'FAILED');

ALTER TYPE "SicoddSyncRunStatus" ADD VALUE IF NOT EXISTS 'QUEUED';

ALTER TABLE "SicoddSyncSettings"
  ADD COLUMN "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduleHour" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "scheduleMinute" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scheduledFullSyncLimit" INTEGER,
  ADD COLUMN "lastScheduledRunAt" TIMESTAMP(3);

ALTER TABLE "SicoddSyncRun"
  ALTER COLUMN "requestedById" DROP NOT NULL,
  ADD COLUMN "trigger" "SicoddSyncRunTrigger" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sequence" INTEGER,
  ADD COLUMN "scope" JSONB;

ALTER TABLE "SicoddSyncRun"
  DROP CONSTRAINT IF EXISTS "SicoddSyncRun_requestedById_fkey";
ALTER TABLE "SicoddSyncRun"
  ADD CONSTRAINT "SicoddSyncRun_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD COLUMN "supplierDetailsHash" CHAR(64),
  ADD COLUMN "supplierImagesHash" CHAR(64),
  ADD COLUMN "supplierSpecificationsHash" CHAR(64),
  ADD COLUMN "supplierSourcePayload" JSONB,
  ADD COLUMN "supplierLastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "supplierLastSeenAt" TIMESTAMP(3);

CREATE TABLE "SicoddSyncProductRecord" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "productId" TEXT,
  "externalKey" VARCHAR(220) NOT NULL,
  "sku" VARCHAR(160),
  "result" "SicoddSyncProductResult" NOT NULL,
  "changedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "previousPriceWithTax" DECIMAL(14, 2),
  "nextPriceWithTax" DECIMAL(14, 2),
  "previousCostWithTax" DECIMAL(14, 2),
  "nextCostWithTax" DECIMAL(14, 2),
  "previousStockTotal" INTEGER,
  "nextStockTotal" INTEGER,
  "imagesDetected" INTEGER NOT NULL DEFAULT 0,
  "imagesQueued" INTEGER NOT NULL DEFAULT 0,
  "imagesSkipped" INTEGER NOT NULL DEFAULT 0,
  "detailsHash" CHAR(64),
  "errorSummary" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SicoddSyncProductRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductImageExclusion" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sourceUrl" VARCHAR(2048) NOT NULL,
  "sourceUrlHash" CHAR(64) NOT NULL,
  "sourceContentHash" CHAR(64),
  "reason" VARCHAR(500),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductImageExclusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SicoddSyncRun_settingsId_sequence_key"
  ON "SicoddSyncRun"("settingsId", "sequence");
CREATE UNIQUE INDEX "SicoddSyncProductRecord_runId_externalKey_key"
  ON "SicoddSyncProductRecord"("runId", "externalKey");
CREATE INDEX "SicoddSyncProductRecord_runId_result_idx"
  ON "SicoddSyncProductRecord"("runId", "result");
CREATE INDEX "SicoddSyncProductRecord_productId_createdAt_idx"
  ON "SicoddSyncProductRecord"("productId", "createdAt");
CREATE INDEX "SicoddSyncProductRecord_runId_previousPriceWithTax_nextPriceWithTax_idx"
  ON "SicoddSyncProductRecord"("runId", "previousPriceWithTax", "nextPriceWithTax");
CREATE UNIQUE INDEX "ProductImageExclusion_productId_sourceUrlHash_key"
  ON "ProductImageExclusion"("productId", "sourceUrlHash");
CREATE INDEX "ProductImageExclusion_productId_createdAt_idx"
  ON "ProductImageExclusion"("productId", "createdAt");
CREATE INDEX "ProductImageExclusion_sourceContentHash_idx"
  ON "ProductImageExclusion"("sourceContentHash");
CREATE INDEX "Product_supplierLastSyncedAt_idx" ON "Product"("supplierLastSyncedAt");

ALTER TABLE "SicoddSyncProductRecord"
  ADD CONSTRAINT "SicoddSyncProductRecord_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "SicoddSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SicoddSyncProductRecord"
  ADD CONSTRAINT "SicoddSyncProductRecord_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductImageExclusion"
  ADD CONSTRAINT "ProductImageExclusion_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductImageExclusion"
  ADD CONSTRAINT "ProductImageExclusion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
