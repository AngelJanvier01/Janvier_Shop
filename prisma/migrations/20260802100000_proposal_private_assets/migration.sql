-- Private proposal assets: immutable deduplicated blobs and revision-local references.
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_UPLOADED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_BLOB_REUSED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_REPLACED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_ALIAS_CHANGED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_ALT_UPDATED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_REQUIRED_CHANGED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_REMOVED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_RESTORED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_REFERENCE_CLONED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_ACCESSED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_GC_DELETED';
ALTER TYPE "ProposalEventType" ADD VALUE IF NOT EXISTS 'PROPOSAL_ASSET_GC_FAILED';

CREATE TABLE "ProposalAssetBlob" (
  "id" TEXT NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "mimeType" VARCHAR(128) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProposalAssetBlob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalAsset" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "blobId" TEXT NOT NULL,
  "alias" VARCHAR(80) NOT NULL,
  "originalFileName" VARCHAR(255) NOT NULL,
  "altText" VARCHAR(500) NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "isDecorative" BOOLEAN NOT NULL DEFAULT false,
  "uploadedByAdminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),

  CONSTRAINT "ProposalAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalAssetBlob_storageKey_key" ON "ProposalAssetBlob"("storageKey");
CREATE UNIQUE INDEX "ProposalAssetBlob_sha256_key" ON "ProposalAssetBlob"("sha256");
CREATE UNIQUE INDEX "ProposalAsset_revisionId_alias_key" ON "ProposalAsset"("revisionId", "alias");
CREATE INDEX "ProposalAsset_blobId_idx" ON "ProposalAsset"("blobId");
CREATE INDEX "ProposalAsset_revisionId_removedAt_idx" ON "ProposalAsset"("revisionId", "removedAt");

ALTER TABLE "ProposalAsset"
  ADD CONSTRAINT "ProposalAsset_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalAsset"
  ADD CONSTRAINT "ProposalAsset_blobId_fkey"
  FOREIGN KEY ("blobId") REFERENCES "ProposalAssetBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProposalAsset"
  ADD CONSTRAINT "ProposalAsset_uploadedByAdminId_fkey"
  FOREIGN KEY ("uploadedByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
