-- Hito H: additive frozen-public-document and dual-hash evidence fields.
-- Existing project-room-v1 acceptances remain valid and are never rewritten.

ALTER TABLE "ProposalRevision"
  ADD COLUMN "resolvedVariables" JSONB,
  ADD COLUMN "frozenPublicDocument" JSONB,
  ADD COLUMN "publicContentHash" CHAR(64),
  ADD COLUMN "evidenceHash" CHAR(64),
  ADD COLUMN "frozenAt" TIMESTAMP(3);

CREATE INDEX "ProposalRevision_publicContentHash_idx"
  ON "ProposalRevision"("publicContentHash");

ALTER TABLE "ProposalAcceptance"
  ADD COLUMN "snapshotVersion" VARCHAR(48) NOT NULL DEFAULT 'project-room-v1',
  ADD COLUMN "publicContentHash" CHAR(64),
  ADD COLUMN "evidenceHash" CHAR(64),
  ADD COLUMN "sourceCheckpointId" TEXT;

CREATE INDEX "ProposalAcceptance_publicContentHash_idx"
  ON "ProposalAcceptance"("publicContentHash");
CREATE INDEX "ProposalAcceptance_sourceCheckpointId_idx"
  ON "ProposalAcceptance"("sourceCheckpointId");
