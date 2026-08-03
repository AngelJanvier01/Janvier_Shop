-- Hito H follow-up: retain the private evidence package and protect the
-- PRE_SHARE checkpoint referenced by a commercial acceptance.

ALTER TABLE "ProposalRevision"
  ADD COLUMN "frozenPrivateEvidence" JSONB;

ALTER TABLE "ProposalAcceptance"
  ADD CONSTRAINT "ProposalAcceptance_sourceCheckpointId_fkey"
  FOREIGN KEY ("sourceCheckpointId")
  REFERENCES "ProposalMarkdownCheckpoint"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
