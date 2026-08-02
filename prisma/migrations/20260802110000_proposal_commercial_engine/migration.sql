-- PROPOSAL_STUDIO_COMMERCIAL_ENGINE
-- Additive commercial domain. V1 Proposal, ProposalRevision and snapshot fields
-- are deliberately retained for historical Project Room compatibility.

ALTER TYPE "ProposalLineItemType" ADD VALUE IF NOT EXISTS 'HOURLY';
ALTER TYPE "ProposalLineItemType" ADD VALUE IF NOT EXISTS 'PER_USER';
ALTER TYPE "ProposalLineItemType" ADD VALUE IF NOT EXISTS 'PER_DEVICE';
ALTER TYPE "ProposalLineItemType" ADD VALUE IF NOT EXISTS 'PER_LOCATION';
ALTER TYPE "ProposalLineItemType" ADD VALUE IF NOT EXISTS 'PER_SITE';

ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_OPTION_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_OPTION_UPDATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_OPTION_ARCHIVED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_OPTION_RESTORED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_OPTION_REORDERED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_LINE_ITEM_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_LINE_ITEM_UPDATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_LINE_ITEM_ARCHIVED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_LINE_ITEM_RESTORED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_LINE_ITEM_REORDERED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_TIMELINE_PHASE_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_TIMELINE_PHASE_UPDATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_TIMELINE_PHASE_REMOVED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_TIMELINE_REORDERED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_PAYMENT_STAGE_CREATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_PAYMENT_STAGE_UPDATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_PAYMENT_STAGE_REMOVED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_COMMERCIAL_RECALCULATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_COMMERCIAL_CONFLICT';

CREATE TYPE "ProposalDiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE "ProposalPricingMode" AS ENUM ('MARKUP', 'MANUAL');
CREATE TYPE "ProposalLineItemScope" AS ENUM ('COMMON', 'OPTION_SPECIFIC');
CREATE TYPE "ProposalTaxDisplayMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');
CREATE TYPE "ProposalTimelineDurationUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');
CREATE TYPE "ProposalPaymentCalculationType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'REMAINDER');
CREATE TYPE "ProposalPaymentTriggerType" AS ENUM ('ACCEPTANCE', 'PROJECT_START', 'MILESTONE', 'DELIVERY', 'CALENDAR_DATE', 'MANUAL');

ALTER TABLE "ProposalRevision"
  ADD COLUMN "commercialVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "commercialCalculationVersion" VARCHAR(48) NOT NULL DEFAULT 'janvier-commercial-v1',
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
  ADD COLUMN "validUntil" TIMESTAMP(3),
  ADD COLUMN "taxDisplayMode" "ProposalTaxDisplayMode" NOT NULL DEFAULT 'EXCLUSIVE',
  ADD COLUMN "paymentTermsSummary" VARCHAR(1000),
  ADD COLUMN "deliveryTerms" VARCHAR(2000),
  ADD COLUMN "warrantySummary" VARCHAR(2000),
  ADD COLUMN "supportSummary" VARCHAR(2000);

-- Preserve the effective V1 commercial values for administrators while V1
-- Project Room keeps reading the original Proposal fields and old snapshots.
UPDATE "ProposalRevision" AS revision
SET "currency" = proposal."currency",
    "validUntil" = proposal."validUntil"
FROM "Proposal" AS proposal
WHERE proposal."id" = revision."proposalId";

ALTER TABLE "ProposalOption"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "estimatedDuration" VARCHAR(160),
  ADD COLUMN "supportSummary" VARCHAR(1000),
  ADD COLUMN "conditionsSummary" VARCHAR(1000),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "ProposalOption"
SET "isActive" = "isEnabled";

-- A historical revision may only have one enabled recommended option. Keep the
-- first by position; this does not delete or rewrite the remaining options.
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "revisionId" ORDER BY "position" ASC, "createdAt" ASC
  ) AS rank
  FROM "ProposalOption"
  WHERE "recommended" = true AND "isActive" = true
)
UPDATE "ProposalOption" AS option
SET "recommended" = false
FROM ranked
WHERE option."id" = ranked."id" AND ranked.rank > 1;

ALTER TABLE "ProposalLineItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(18,4),
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18,2),
  ALTER COLUMN "internalCost" TYPE DECIMAL(18,2),
  ALTER COLUMN "markupPercent" TYPE DECIMAL(9,4),
  ALTER COLUMN "taxRate" TYPE DECIMAL(9,4),
  ADD COLUMN "name" VARCHAR(255) NOT NULL DEFAULT 'Concepto',
  ADD COLUMN "unit" VARCHAR(40) NOT NULL DEFAULT 'service',
  ADD COLUMN "billingType" "ProposalLineItemType" NOT NULL DEFAULT 'ONE_TIME',
  ADD COLUMN "discountType" "ProposalDiscountType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "discountValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "isTaxable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scope" "ProposalLineItemScope" NOT NULL DEFAULT 'OPTION_SPECIFIC',
  ADD COLUMN "isOptional" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selectedByDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pricingMode" "ProposalPricingMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "contingencyPercent" DECIMAL(9,4),
  ADD COLUMN "supplier" VARCHAR(255),
  ADD COLUMN "supplierReference" VARCHAR(255),
  ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "ProposalLineItem"
SET "name" = "description",
    "billingType" = "type",
    "discountType" = CASE WHEN "discount" > 0 THEN 'FIXED_AMOUNT'::"ProposalDiscountType" ELSE 'NONE'::"ProposalDiscountType" END,
    "discountValue" = "discount",
    "isTaxable" = "taxRate" > 0,
    "scope" = CASE WHEN "optionId" IS NULL THEN 'COMMON'::"ProposalLineItemScope" ELSE 'OPTION_SPECIFIC'::"ProposalLineItemScope" END,
    "isOptional" = "type" = 'OPTIONAL',
    "isIncluded" = "type" = 'INCLUDED',
    "visibleToClient" = "visibleForClient",
    "pricingMode" = CASE WHEN "internalCost" IS NOT NULL AND "markupPercent" IS NOT NULL THEN 'MARKUP'::"ProposalPricingMode" ELSE 'MANUAL'::"ProposalPricingMode" END;

CREATE UNIQUE INDEX "ProposalOption_revisionId_activeRecommended_key"
  ON "ProposalOption"("revisionId")
  WHERE "recommended" = true AND "isActive" = true;
CREATE UNIQUE INDEX "ProposalLineItem_revisionId_code_key" ON "ProposalLineItem"("revisionId", "code");
CREATE INDEX "ProposalLineItem_revisionId_removedAt_idx" ON "ProposalLineItem"("revisionId", "removedAt");

CREATE TABLE "ProposalTimelinePhase" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "optionId" TEXT,
  "code" VARCHAR(80) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" VARCHAR(4000),
  "position" INTEGER NOT NULL,
  "durationValue" INTEGER NOT NULL,
  "durationUnit" "ProposalTimelineDurationUnit" NOT NULL,
  "estimatedStartDate" TIMESTAMP(3),
  "estimatedEndDate" TIMESTAMP(3),
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalTimelinePhase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalTimelineDependency" (
  "id" TEXT NOT NULL,
  "phaseId" TEXT NOT NULL,
  "dependsOnPhaseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalTimelineDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalTimelineDeliverable" (
  "id" TEXT NOT NULL,
  "phaseId" TEXT NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" VARCHAR(4000),
  "position" INTEGER NOT NULL,
  "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ProposalTimelineDeliverable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalPaymentStage" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "optionId" TEXT,
  "title" VARCHAR(255) NOT NULL,
  "description" VARCHAR(2000),
  "position" INTEGER NOT NULL,
  "calculationType" "ProposalPaymentCalculationType" NOT NULL,
  "percentage" DECIMAL(9,4),
  "fixedAmount" DECIMAL(18,2),
  "triggerType" "ProposalPaymentTriggerType" NOT NULL,
  "triggerDescription" VARCHAR(1000),
  "dueDays" INTEGER,
  "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProposalPaymentStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalTimelinePhase_revisionId_code_key" ON "ProposalTimelinePhase"("revisionId", "code");
CREATE UNIQUE INDEX "ProposalTimelinePhase_revisionId_position_key" ON "ProposalTimelinePhase"("revisionId", "position");
CREATE INDEX "ProposalTimelinePhase_revisionId_optionId_idx" ON "ProposalTimelinePhase"("revisionId", "optionId");
CREATE UNIQUE INDEX "ProposalTimelineDependency_phaseId_dependsOnPhaseId_key" ON "ProposalTimelineDependency"("phaseId", "dependsOnPhaseId");
CREATE INDEX "ProposalTimelineDependency_dependsOnPhaseId_idx" ON "ProposalTimelineDependency"("dependsOnPhaseId");
CREATE UNIQUE INDEX "ProposalTimelineDeliverable_phaseId_position_key" ON "ProposalTimelineDeliverable"("phaseId", "position");
CREATE INDEX "ProposalTimelineDeliverable_phaseId_idx" ON "ProposalTimelineDeliverable"("phaseId");
CREATE UNIQUE INDEX "ProposalPaymentStage_revisionId_position_key" ON "ProposalPaymentStage"("revisionId", "position");
CREATE INDEX "ProposalPaymentStage_revisionId_optionId_idx" ON "ProposalPaymentStage"("revisionId", "optionId");

ALTER TABLE "ProposalTimelinePhase"
  ADD CONSTRAINT "ProposalTimelinePhase_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProposalTimelinePhase_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProposalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProposalTimelineDependency"
  ADD CONSTRAINT "ProposalTimelineDependency_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "ProposalTimelinePhase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProposalTimelineDependency_dependsOnPhaseId_fkey"
  FOREIGN KEY ("dependsOnPhaseId") REFERENCES "ProposalTimelinePhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProposalTimelineDeliverable"
  ADD CONSTRAINT "ProposalTimelineDeliverable_phaseId_fkey"
  FOREIGN KEY ("phaseId") REFERENCES "ProposalTimelinePhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalPaymentStage"
  ADD CONSTRAINT "ProposalPaymentStage_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProposalPaymentStage_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProposalOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
