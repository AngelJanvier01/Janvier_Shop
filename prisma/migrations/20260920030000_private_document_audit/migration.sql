-- Sensitive back-office downloads need a durable, target-aware audit trail.
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'CUSTOMER_DOCUMENT_DOWNLOADED';
ALTER TYPE "AdminAuditEventType" ADD VALUE IF NOT EXISTS 'SPEI_PROOF_DOWNLOADED';

ALTER TABLE "AdminAuditEvent" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
