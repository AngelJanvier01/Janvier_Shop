CREATE TYPE "SicoddSyncRunType" AS ENUM ('CONNECTION_TEST', 'SAMPLE_CAPTURE', 'DAILY_SYNC');

CREATE TYPE "SicoddSyncRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "SicoddSyncSettings" (
  "id" TEXT NOT NULL,
  "productListPath" VARCHAR(512),
  "sampleLimit" INTEGER NOT NULL DEFAULT 12,
  "includeImages" BOOLEAN NOT NULL DEFAULT true,
  "includeExternalWarehouses" BOOLEAN NOT NULL DEFAULT false,
  "importAsDraft" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "lastConnectionAt" TIMESTAMP(3),
  "lastConnectionError" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SicoddSyncSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SicoddSyncRun" (
  "id" TEXT NOT NULL,
  "settingsId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "type" "SicoddSyncRunType" NOT NULL,
  "status" "SicoddSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "productListPath" VARCHAR(512),
  "requestedLimit" INTEGER,
  "includeImages" BOOLEAN NOT NULL,
  "includeExternalWarehouses" BOOLEAN NOT NULL,
  "diagnostics" JSONB,
  "errorSummary" VARCHAR(2000),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "SicoddSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SicoddImportCandidate" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceUrl" VARCHAR(2048) NOT NULL,
  "sourceKey" VARCHAR(160),
  "name" VARCHAR(500),
  "partNumber" VARCHAR(160),
  "upc" VARCHAR(160),
  "warrantyYears" INTEGER,
  "description" TEXT,
  "imageUrls" JSONB,
  "specifications" JSONB,
  "sourcePayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SicoddImportCandidate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SicoddSyncRun_settingsId_startedAt_idx" ON "SicoddSyncRun"("settingsId", "startedAt");
CREATE INDEX "SicoddSyncRun_status_startedAt_idx" ON "SicoddSyncRun"("status", "startedAt");
CREATE UNIQUE INDEX "SicoddImportCandidate_runId_sourceUrl_key" ON "SicoddImportCandidate"("runId", "sourceUrl");
CREATE INDEX "SicoddImportCandidate_partNumber_idx" ON "SicoddImportCandidate"("partNumber");
CREATE INDEX "SicoddImportCandidate_upc_idx" ON "SicoddImportCandidate"("upc");

ALTER TABLE "SicoddSyncSettings"
  ADD CONSTRAINT "SicoddSyncSettings_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SicoddSyncRun"
  ADD CONSTRAINT "SicoddSyncRun_settingsId_fkey"
  FOREIGN KEY ("settingsId") REFERENCES "SicoddSyncSettings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SicoddSyncRun"
  ADD CONSTRAINT "SicoddSyncRun_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SicoddImportCandidate"
  ADD CONSTRAINT "SicoddImportCandidate_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "SicoddSyncRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
