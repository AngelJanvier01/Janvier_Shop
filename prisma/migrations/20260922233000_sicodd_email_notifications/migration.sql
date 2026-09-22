ALTER TYPE "EmailNotificationKind" ADD VALUE IF NOT EXISTS 'ADMIN_SICODD_SYNC_STARTED';
ALTER TYPE "EmailNotificationKind" ADD VALUE IF NOT EXISTS 'ADMIN_SICODD_SYNC_COMPLETED';
ALTER TYPE "EmailNotificationKind" ADD VALUE IF NOT EXISTS 'ADMIN_SICODD_SYNC_FAILED';
ALTER TYPE "EmailNotificationKind" ADD VALUE IF NOT EXISTS 'ADMIN_SICODD_IMAGE_PROCESSING_COMPLETED';

ALTER TABLE "EmailOutbox"
  ADD COLUMN "sicoddSyncRunId" TEXT,
  ADD COLUMN "attachmentFilename" VARCHAR(255),
  ADD COLUMN "attachmentContentType" VARCHAR(160),
  ADD COLUMN "attachmentData" BYTEA;

ALTER TABLE "EmailOutbox"
  ADD CONSTRAINT "EmailOutbox_sicoddSyncRunId_fkey"
  FOREIGN KEY ("sicoddSyncRunId") REFERENCES "SicoddSyncRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EmailOutbox_sicoddSyncRunId_kind_idx"
  ON "EmailOutbox"("sicoddSyncRunId", "kind");
