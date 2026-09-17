-- Individual viewer identities and append-only opening records for Project Room.
-- Existing invitations remain valid only after the visitor identifies themselves again.

CREATE TABLE "ProposalInviteViewer" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalInviteViewer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalInviteView" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "ip" VARCHAR(96),
    "userAgent" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalInviteView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProposalInviteViewer_inviteId_lastViewedAt_idx"
ON "ProposalInviteViewer"("inviteId", "lastViewedAt");

CREATE INDEX "ProposalInviteViewer_inviteId_name_idx"
ON "ProposalInviteViewer"("inviteId", "name");

CREATE INDEX "ProposalInviteView_inviteId_createdAt_idx"
ON "ProposalInviteView"("inviteId", "createdAt");

CREATE INDEX "ProposalInviteView_viewerId_createdAt_idx"
ON "ProposalInviteView"("viewerId", "createdAt");

ALTER TABLE "ProposalInviteViewer"
ADD CONSTRAINT "ProposalInviteViewer_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "ProposalInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalInviteView"
ADD CONSTRAINT "ProposalInviteView_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "ProposalInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalInviteView"
ADD CONSTRAINT "ProposalInviteView_viewerId_fkey"
FOREIGN KEY ("viewerId") REFERENCES "ProposalInviteViewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
