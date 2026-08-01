-- Proposal invite code attempts are retained briefly for rate limiting and audit.
CREATE TABLE "ProposalInviteAttempt" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalInviteAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProposalInviteAttempt_inviteId_createdAt_idx"
ON "ProposalInviteAttempt"("inviteId", "createdAt");

ALTER TABLE "ProposalInviteAttempt"
ADD CONSTRAINT "ProposalInviteAttempt_inviteId_fkey"
FOREIGN KEY ("inviteId") REFERENCES "ProposalInvite"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
