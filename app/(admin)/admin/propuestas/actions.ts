"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { createProposalInviteCredentials } from "@/lib/proposals/invite-security";

const proposalInput = z.object({
  clientEmail: z.string().email().max(320),
  clientName: z.string().trim().min(2).max(160),
  companyName: z.string().trim().max(160).optional(),
  context: z.string().trim().min(12).max(4000),
  title: z.string().trim().min(4).max(180)
});

type CreateProposalState = {
  accessCode?: string;
  error?: string;
  shareUrl?: string;
};

export type IssueProposalInviteState = {
  accessCode?: string;
  error?: string;
  shareUrl?: string;
};

function reference() {
  return `JAN-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createProposal(
  _previousState: CreateProposalState,
  formData: FormData
): Promise<CreateProposalState> {
  const admin = await requireCurrentAdmin();
  const parsed = proposalInput.safeParse({
    clientEmail: formData.get("clientEmail"),
    clientName: formData.get("clientName"),
    companyName: formData.get("companyName") || undefined,
    context: formData.get("context"),
    title: formData.get("title")
  });
  if (!parsed.success) {
    return { error: "Revisa los datos antes de crear la propuesta." };
  }

  const input = parsed.data;
  const credentials = await createProposalInviteCredentials();
  await database.$transaction(async (transaction) => {
    const client = await transaction.client.create({
      data: {
        companyName: input.companyName || null,
        contactName: input.clientName,
        email: input.clientEmail.toLowerCase()
      }
    });
    const proposal = await transaction.proposal.create({
      data: {
        clientId: client.id,
        ownerId: admin.id,
        reference: reference(),
        sentAt: new Date(),
        status: "SENT",
        title: input.title
      }
    });
    const revision = await transaction.proposalRevision.create({
      data: {
        authorId: admin.id,
        introduction: input.context,
        proposalId: proposal.id,
        revision: 1,
        title: input.title
      }
    });
    await transaction.proposalSection.create({
      data: {
        content: input.context,
        position: 1,
        revisionId: revision.id,
        title: "Contexto y objetivo",
        type: "CONTEXT"
      }
    });
    await transaction.proposalEvent.create({
      data: {
        adminActorId: admin.id,
        proposalId: proposal.id,
        revisionId: revision.id,
        type: "CREATED"
      }
    });
    const invite = await transaction.proposalInvite.create({
      data: {
        codeHash: credentials.accessCodeHash,
        createdById: admin.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        proposalId: proposal.id,
        recipientEmail: client.email,
        revisionId: revision.id,
        tokenHash: credentials.tokenHash
      }
    });
    await transaction.proposalEvent.create({
      data: {
        adminActorId: admin.id,
        metadata: { inviteId: invite.id },
        proposalId: proposal.id,
        revisionId: revision.id,
        type: "INVITED"
      }
    });
    return proposal;
  });

  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  return {
    accessCode: credentials.accessCode,
    shareUrl: new URL(`/propuesta/${credentials.token}`, siteUrl).toString()
  };
}

export async function issueProposalInvite(
  proposalId: string,
  previousState: IssueProposalInviteState,
  formData: FormData
): Promise<IssueProposalInviteState> {
  void previousState;
  void formData;
  const admin = await requireCurrentAdmin();
  const proposal = await database.proposal.findUnique({
    where: { id: proposalId },
    include: {
      client: true,
      revisions: { orderBy: { revision: "desc" }, take: 1 }
    }
  });
  if (!proposal || !proposal.revisions[0]) {
    return { error: "No encontramos una revision disponible para esta propuesta." };
  }
  if (proposal.status === "ACCEPTED") {
    return {
      error: "La propuesta ya fue aceptada; no es posible emitir otra invitacion."
    };
  }

  const credentials = await createProposalInviteCredentials();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const revision = proposal.revisions[0];
  await database.$transaction(async (transaction) => {
    const revoked = await transaction.proposalInvite.updateMany({
      where: { proposalId, status: "ACTIVE" },
      data: { revokedAt: new Date(), status: "REVOKED" }
    });
    if (revoked.count) {
      await transaction.proposalEvent.create({
        data: {
          adminActorId: admin.id,
          metadata: { count: revoked.count, reason: "new_invite_issued" },
          proposalId,
          revisionId: revision.id,
          type: "REVOKED"
        }
      });
    }
    const invite = await transaction.proposalInvite.create({
      data: {
        codeHash: credentials.accessCodeHash,
        createdById: admin.id,
        expiresAt,
        proposalId,
        recipientEmail: proposal.client.email,
        revisionId: revision.id,
        tokenHash: credentials.tokenHash
      }
    });
    await transaction.proposal.update({
      where: { id: proposalId },
      data: { sentAt: new Date(), status: "SENT" }
    });
    await transaction.proposalEvent.create({
      data: {
        adminActorId: admin.id,
        metadata: { inviteId: invite.id },
        proposalId,
        revisionId: revision.id,
        type: "INVITED"
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  revalidatePath(`/admin/propuestas/${proposalId}`);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  return {
    accessCode: credentials.accessCode,
    shareUrl: new URL(`/propuesta/${credentials.token}`, siteUrl).toString()
  };
}
