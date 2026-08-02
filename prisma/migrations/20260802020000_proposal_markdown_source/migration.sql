-- Proposal Studio Hito A: versioned Markdown sources and safe parsed-section metadata.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'COVER';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'EXECUTIVE_SUMMARY';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'PROBLEM';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'OBJECTIVES';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'SOLUTION';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'ARCHITECTURE';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'ALTERNATIVES';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'EXCLUSIONS';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'NEXT_STEPS';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'FAQ';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'CALLOUT';
ALTER TYPE "ProposalSectionType" ADD VALUE IF NOT EXISTS 'METRICS';

CREATE TYPE "ProposalMarkdownParseStatus" AS ENUM ('VALID', 'WARNINGS', 'ERROR');
CREATE TYPE "ProposalMarkdownCheckpointReason" AS ENUM (
    'IMPORT',
    'REIMPORT_REPLACE',
    'REIMPORT_MERGE',
    'APPEND',
    'MANUAL_SAVE',
    'TEMPLATE_APPLIED',
    'RESTORE',
    'PRE_SHARE',
    'REVISION_CLONED'
);

ALTER TABLE "ProposalSection"
    ADD COLUMN "sourceId" VARCHAR(64),
    ADD COLUMN "slug" VARCHAR(96),
    ADD COLUMN "contentAst" JSONB,
    ADD COLUMN "internalOnly" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "sourceStartLine" INTEGER,
    ADD COLUMN "sourceEndLine" INTEGER,
    ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "ProposalSection"
SET
    "sourceId" = 'legacy-' || "id",
    "slug" = 'legacy-' || "id"
WHERE "sourceId" IS NULL;

ALTER TABLE "ProposalSection"
    ALTER COLUMN "sourceId" SET NOT NULL,
    ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "ProposalSection_revisionId_sourceId_key"
    ON "ProposalSection"("revisionId", "sourceId");
CREATE UNIQUE INDEX "ProposalSection_revisionId_slug_key"
    ON "ProposalSection"("revisionId", "slug");
CREATE INDEX "ProposalSection_revisionId_removedAt_idx"
    ON "ProposalSection"("revisionId", "removedAt");

CREATE TABLE "ProposalMarkdownSource" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "sourceRevisionId" TEXT,
    "originalFileName" VARCHAR(255),
    "sourceMarkdown" TEXT NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "encoding" VARCHAR(16) NOT NULL DEFAULT 'UTF-8',
    "parserVersion" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parseStatus" "ProposalMarkdownParseStatus" NOT NULL,
    "parseWarnings" JSONB,
    "normalizedAst" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByAdminId" TEXT NOT NULL,
    "lastParsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalMarkdownSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalMarkdownCheckpoint" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "reason" "ProposalMarkdownCheckpointReason" NOT NULL,
    "sourceMarkdown" TEXT NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "parserVersion" VARCHAR(32) NOT NULL,
    "parseStatus" "ProposalMarkdownParseStatus" NOT NULL,
    "parseWarnings" JSONB,
    "originalFileName" VARCHAR(255),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalMarkdownCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalMarkdownSource_revisionId_key"
    ON "ProposalMarkdownSource"("revisionId");
CREATE INDEX "ProposalMarkdownSource_sourceRevisionId_idx"
    ON "ProposalMarkdownSource"("sourceRevisionId");
CREATE INDEX "ProposalMarkdownSource_importedByAdminId_idx"
    ON "ProposalMarkdownSource"("importedByAdminId");
CREATE UNIQUE INDEX "ProposalMarkdownCheckpoint_sourceId_sequence_key"
    ON "ProposalMarkdownCheckpoint"("sourceId", "sequence");
CREATE INDEX "ProposalMarkdownCheckpoint_sourceId_createdAt_idx"
    ON "ProposalMarkdownCheckpoint"("sourceId", "createdAt");
CREATE INDEX "ProposalMarkdownCheckpoint_createdByAdminId_idx"
    ON "ProposalMarkdownCheckpoint"("createdByAdminId");

ALTER TABLE "ProposalMarkdownSource"
    ADD CONSTRAINT "ProposalMarkdownSource_revisionId_fkey"
        FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ProposalMarkdownSource_sourceRevisionId_fkey"
        FOREIGN KEY ("sourceRevisionId") REFERENCES "ProposalRevision"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ProposalMarkdownSource_importedByAdminId_fkey"
        FOREIGN KEY ("importedByAdminId") REFERENCES "AdminUser"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProposalMarkdownCheckpoint"
    ADD CONSTRAINT "ProposalMarkdownCheckpoint_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "ProposalMarkdownSource"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ProposalMarkdownCheckpoint_createdByAdminId_fkey"
        FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;

WITH "legacy_sources" AS (
    SELECT
        revision."id" AS "revisionId",
        revision."authorId" AS "authorId",
        revision."createdAt" AS "createdAt",
        revision."updatedAt" AS "updatedAt",
        '# ' || revision."title" ||
        CASE
            WHEN COUNT(section."id") = 0 THEN E'\n'
            ELSE E'\n\n' || string_agg(
                '## ' ||
                regexp_replace(section."title", E'[\\r\\n]+', ' ', 'g') ||
                ' {#legacy-' || section."id" || ' type=' || section."type"::text || '}' ||
                CASE
                    WHEN section."content" IS NULL OR btrim(section."content") = '' THEN ''
                    ELSE E'\n\n' || section."content"
                END,
                E'\n\n'
                ORDER BY section."position"
            )
        END AS "sourceMarkdown"
    FROM "ProposalRevision" AS revision
    LEFT JOIN "ProposalSection" AS section ON section."revisionId" = revision."id"
    GROUP BY revision."id", revision."authorId", revision."title", revision."createdAt", revision."updatedAt"
)
INSERT INTO "ProposalMarkdownSource" (
    "id",
    "revisionId",
    "originalFileName",
    "sourceMarkdown",
    "sourceHash",
    "parserVersion",
    "parseStatus",
    "normalizedAst",
    "importedAt",
    "importedByAdminId",
    "lastParsedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy-source-' || "revisionId",
    "revisionId",
    'legacy-generated.md',
    "sourceMarkdown",
    encode(digest("sourceMarkdown", 'sha256'), 'hex'),
    'legacy-generated-v1',
    'VALID',
    jsonb_build_object('version', 'legacy-generated-v1', 'blocks', jsonb_build_array()),
    "createdAt",
    "authorId",
    "updatedAt",
    "createdAt",
    "updatedAt"
FROM "legacy_sources";

INSERT INTO "ProposalMarkdownCheckpoint" (
    "id",
    "sourceId",
    "sequence",
    "reason",
    "sourceMarkdown",
    "sourceHash",
    "parserVersion",
    "parseStatus",
    "originalFileName",
    "createdByAdminId",
    "createdAt"
)
SELECT
    'legacy-checkpoint-' || source."revisionId",
    source."id",
    1,
    'IMPORT',
    source."sourceMarkdown",
    source."sourceHash",
    source."parserVersion",
    source."parseStatus",
    source."originalFileName",
    source."importedByAdminId",
    source."importedAt"
FROM "ProposalMarkdownSource" AS source;
