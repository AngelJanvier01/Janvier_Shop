-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailNotificationKind" AS ENUM ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_RATE_LIMITED', 'ADMIN_PASSWORD_CHANGED', 'DIAGNOSTIC_REQUEST_RECEIVED', 'PROPOSAL_EVENT', 'DAILY_REPORT', 'TEST');

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "kind" "EmailNotificationKind" NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dedupeKey" VARCHAR(255) NOT NULL,
    "proposalEventId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "lastError" VARCHAR(2000),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_createdAt_idx" ON "EmailOutbox"("createdAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_proposalEventId_idx" ON "EmailOutbox"("proposalEventId");

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_proposalEventId_fkey" FOREIGN KEY ("proposalEventId") REFERENCES "ProposalEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
