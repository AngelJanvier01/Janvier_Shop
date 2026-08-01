-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'CHANGES_REQUESTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ProposalInviteStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProposalSectionType" AS ENUM ('CONTEXT', 'SCOPE', 'DELIVERABLES', 'TIMELINE', 'INVESTMENT', 'TERMS', 'REFERENCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ProposalDecisionType" AS ENUM ('ACCEPT', 'REQUEST_CHANGES', 'DECLINE');

-- CreateEnum
CREATE TYPE "ProposalEventType" AS ENUM ('CREATED', 'REVISION_CREATED', 'INVITED', 'VIEWED', 'COMMENTED', 'DECIDED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalRevision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "introduction" TEXT,
    "terms" TEXT,
    "investment" DECIMAL(12,2),
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProposalRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSection" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "type" "ProposalSectionType" NOT NULL DEFAULT 'CUSTOM',
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "isIncluded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProposalSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalOption" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "investment" DECIMAL(12,2),
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProposalOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalInvite" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "status" "ProposalInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProposalInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalComment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "inviteId" TEXT,
    "adminAuthorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalDecision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "inviteId" TEXT,
    "type" "ProposalDecisionType" NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "note" TEXT,
    "acceptedTermsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvent" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT,
    "adminActorId" TEXT,
    "type" "ProposalEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX "Client_email_idx" ON "Client"("email");
CREATE INDEX "Client_companyName_idx" ON "Client"("companyName");
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_status_isPublic_idx" ON "Project"("status", "isPublic");
CREATE UNIQUE INDEX "Proposal_reference_key" ON "Proposal"("reference");
CREATE INDEX "Proposal_clientId_status_idx" ON "Proposal"("clientId", "status");
CREATE INDEX "Proposal_projectId_idx" ON "Proposal"("projectId");
CREATE INDEX "Proposal_ownerId_idx" ON "Proposal"("ownerId");
CREATE INDEX "Proposal_validUntil_idx" ON "Proposal"("validUntil");
CREATE INDEX "ProposalRevision_proposalId_sharedAt_idx" ON "ProposalRevision"("proposalId", "sharedAt");
CREATE UNIQUE INDEX "ProposalRevision_proposalId_revision_key" ON "ProposalRevision"("proposalId", "revision");
CREATE INDEX "ProposalSection_revisionId_type_idx" ON "ProposalSection"("revisionId", "type");
CREATE UNIQUE INDEX "ProposalSection_revisionId_position_key" ON "ProposalSection"("revisionId", "position");
CREATE UNIQUE INDEX "ProposalOption_revisionId_code_key" ON "ProposalOption"("revisionId", "code");
CREATE UNIQUE INDEX "ProposalOption_revisionId_position_key" ON "ProposalOption"("revisionId", "position");
CREATE UNIQUE INDEX "ProposalInvite_tokenHash_key" ON "ProposalInvite"("tokenHash");
CREATE INDEX "ProposalInvite_proposalId_status_idx" ON "ProposalInvite"("proposalId", "status");
CREATE INDEX "ProposalInvite_revisionId_idx" ON "ProposalInvite"("revisionId");
CREATE INDEX "ProposalInvite_expiresAt_idx" ON "ProposalInvite"("expiresAt");
CREATE INDEX "ProposalComment_proposalId_createdAt_idx" ON "ProposalComment"("proposalId", "createdAt");
CREATE INDEX "ProposalComment_revisionId_createdAt_idx" ON "ProposalComment"("revisionId", "createdAt");
CREATE INDEX "ProposalDecision_proposalId_createdAt_idx" ON "ProposalDecision"("proposalId", "createdAt");
CREATE INDEX "ProposalDecision_revisionId_createdAt_idx" ON "ProposalDecision"("revisionId", "createdAt");
CREATE INDEX "ProposalEvent_proposalId_createdAt_idx" ON "ProposalEvent"("proposalId", "createdAt");
CREATE INDEX "ProposalEvent_revisionId_createdAt_idx" ON "ProposalEvent"("revisionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalSection" ADD CONSTRAINT "ProposalSection_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalOption" ADD CONSTRAINT "ProposalOption_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalInvite" ADD CONSTRAINT "ProposalInvite_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalInvite" ADD CONSTRAINT "ProposalInvite_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalInvite" ADD CONSTRAINT "ProposalInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ProposalInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalComment" ADD CONSTRAINT "ProposalComment_adminAuthorId_fkey" FOREIGN KEY ("adminAuthorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalDecision" ADD CONSTRAINT "ProposalDecision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalDecision" ADD CONSTRAINT "ProposalDecision_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalDecision" ADD CONSTRAINT "ProposalDecision_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ProposalInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_adminActorId_fkey" FOREIGN KEY ("adminActorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
