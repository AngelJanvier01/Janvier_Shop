-- Sprint Growth Operations: private diagnostic-request intake and pipeline.
-- Additive only; existing clients and proposals remain unchanged.

CREATE TYPE "DiagnosticRequestStatus" AS ENUM (
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST', 'ARCHIVED'
);

CREATE TYPE "DiagnosticRequestSource" AS ENUM (
  'CONTACT_FORM', 'ADMIN', 'REFERRAL'
);

CREATE TABLE "DiagnosticRequest" (
  "id" TEXT NOT NULL,
  "status" "DiagnosticRequestStatus" NOT NULL DEFAULT 'NEW',
  "source" "DiagnosticRequestSource" NOT NULL DEFAULT 'CONTACT_FORM',
  "contactName" VARCHAR(160) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "phone" VARCHAR(48),
  "companyName" VARCHAR(160),
  "service" VARCHAR(120) NOT NULL,
  "timeline" VARCHAR(120),
  "budgetRange" VARCHAR(120),
  "message" VARCHAR(6000) NOT NULL,
  "privateNotes" VARCHAR(4000),
  "requestFingerprint" CHAR(64),
  "clientId" TEXT,
  "proposalId" TEXT,
  "ownerId" TEXT,
  "contactedAt" TIMESTAMP(3),
  "qualifiedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiagnosticRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosticRequest_proposalId_key" ON "DiagnosticRequest"("proposalId");
CREATE INDEX "DiagnosticRequest_status_updatedAt_idx" ON "DiagnosticRequest"("status", "updatedAt");
CREATE INDEX "DiagnosticRequest_email_createdAt_idx" ON "DiagnosticRequest"("email", "createdAt");
CREATE INDEX "DiagnosticRequest_requestFingerprint_createdAt_idx" ON "DiagnosticRequest"("requestFingerprint", "createdAt");
CREATE INDEX "DiagnosticRequest_ownerId_status_idx" ON "DiagnosticRequest"("ownerId", "status");

ALTER TABLE "DiagnosticRequest"
  ADD CONSTRAINT "DiagnosticRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagnosticRequest"
  ADD CONSTRAINT "DiagnosticRequest_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiagnosticRequest"
  ADD CONSTRAINT "DiagnosticRequest_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
