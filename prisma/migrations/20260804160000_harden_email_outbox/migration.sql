-- Preserve historical terminal failures while adopting the explicit DEAD status.
ALTER TYPE "EmailOutboxStatus" RENAME VALUE 'FAILED' TO 'DEAD';

ALTER TABLE "EmailOutbox"
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedBy" VARCHAR(96),
  ADD COLUMN "recoveries" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastErrorCode" VARCHAR(64),
  ADD COLUMN "lastErrorMessage" VARCHAR(2000),
  ADD COLUMN "failedAt" TIMESTAMP(3);

UPDATE "EmailOutbox"
SET "lockedAt" = "claimedAt"
WHERE "claimedAt" IS NOT NULL;

UPDATE "EmailOutbox"
SET "lastErrorMessage" = "lastError"
WHERE "lastError" IS NOT NULL;

ALTER TABLE "EmailOutbox"
  DROP COLUMN "claimedAt",
  DROP COLUMN "lastError";

DROP INDEX "EmailOutbox_status_nextAttemptAt_idx";
CREATE INDEX "EmailOutbox_status_priority_nextAttemptAt_idx"
  ON "EmailOutbox"("status", "priority", "nextAttemptAt");
CREATE INDEX "EmailOutbox_status_lockedAt_idx"
  ON "EmailOutbox"("status", "lockedAt");

CREATE TYPE "AdminAuditEventType" AS ENUM ('PASSWORD_CHANGED');

CREATE TABLE "AdminAuditEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AdminAuditEventType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditEvent_userId_createdAt_idx"
  ON "AdminAuditEvent"("userId", "createdAt");
CREATE INDEX "AdminAuditEvent_type_createdAt_idx"
  ON "AdminAuditEvent"("type", "createdAt");
ALTER TABLE "AdminAuditEvent"
  ADD CONSTRAINT "AdminAuditEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
