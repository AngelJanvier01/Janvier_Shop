-- Project Room hardening: explicit events, option selection, line items and immutable acceptance evidence.
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_EDITED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'REVISION_SHARED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'INVITE_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'INVITE_VIEWED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'OPTION_SELECTED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'COMMENT_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ACCEPTED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_DECLINED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'INVITE_REVOKED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROJECT_CREATED';

CREATE TYPE "ProposalLineItemType" AS ENUM ('ONE_TIME', 'MONTHLY', 'ANNUAL', 'INCLUDED', 'OPTIONAL');
CREATE TYPE "ProposalVerificationMethod" AS ENUM ('INVITE_CODE');

ALTER TABLE "Proposal" ADD COLUMN "selectedOptionId" TEXT;
ALTER TABLE "ProposalRevision" ADD COLUMN "replacedAt" TIMESTAMP(3);
ALTER TABLE "ProposalOption" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ProposalLineItem" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "optionId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "type" "ProposalLineItemType" NOT NULL DEFAULT 'ONE_TIME',
    "position" INTEGER NOT NULL,
    "visibleForClient" BOOLEAN NOT NULL DEFAULT true,
    "internalCost" DECIMAL(12,2),
    "markupPercent" DECIMAL(6,2),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalLineItem_revisionId_position_key" ON "ProposalLineItem"("revisionId", "position");
CREATE INDEX "ProposalLineItem_revisionId_optionId_idx" ON "ProposalLineItem"("revisionId", "optionId");

CREATE TABLE "ProposalAcceptance" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "optionId" TEXT,
    "inviteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "currency" VARCHAR(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "terms" TEXT,
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "verificationMethod" "ProposalVerificationMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalAcceptance_proposalId_key" ON "ProposalAcceptance"("proposalId");
CREATE INDEX "ProposalAcceptance_revisionId_idx" ON "ProposalAcceptance"("revisionId");
CREATE INDEX "ProposalAcceptance_inviteId_idx" ON "ProposalAcceptance"("inviteId");
CREATE INDEX "ProposalAcceptance_contentHash_idx" ON "ProposalAcceptance"("contentHash");
CREATE INDEX "Proposal_selectedOptionId_idx" ON "Proposal"("selectedOptionId");

ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_selectedOptionId_fkey"
FOREIGN KEY ("selectedOptionId") REFERENCES "ProposalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalLineItem" ADD CONSTRAINT "ProposalLineItem_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalLineItem" ADD CONSTRAINT "ProposalLineItem_optionId_fkey"
FOREIGN KEY ("optionId") REFERENCES "ProposalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalAcceptance" ADD CONSTRAINT "ProposalAcceptance_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalAcceptance" ADD CONSTRAINT "ProposalAcceptance_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalAcceptance" ADD CONSTRAINT "ProposalAcceptance_optionId_fkey"
FOREIGN KEY ("optionId") REFERENCES "ProposalOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalAcceptance" ADD CONSTRAINT "ProposalAcceptance_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "ProposalInvite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
