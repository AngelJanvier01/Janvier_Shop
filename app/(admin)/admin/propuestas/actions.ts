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

const revisionInput = z.object({
  introduction: z.string().trim().max(4000),
  investment: z.string().trim().max(40),
  terms: z.string().trim().max(4000),
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

export type ProposalRevisionState = {
  error?: string;
  success?: string;
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
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
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
        sentAt: now,
        status: "SENT",
        title: input.title,
        validUntil: expiresAt
      }
    });
    const revision = await transaction.proposalRevision.create({
      data: {
        authorId: admin.id,
        introduction: input.context,
        lockedAt: now,
        proposalId: proposal.id,
        revision: 1,
        sharedAt: now,
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
        expiresAt,
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
      data: { sentAt: new Date(), status: "SENT", validUntil: expiresAt }
    });
    await transaction.proposalRevision.update({
      where: { id: revision.id },
      data: {
        lockedAt: revision.lockedAt ?? new Date(),
        sharedAt: revision.sharedAt ?? new Date()
      }
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

export async function createEditableProposalRevision(proposalId: string) {
  const admin = await requireCurrentAdmin();
  const proposal = await database.proposal.findUnique({
    where: { id: proposalId },
    include: {
      revisions: {
        include: {
          options: { orderBy: { position: "asc" } },
          sections: { orderBy: { position: "asc" } }
        },
        orderBy: { revision: "desc" },
        take: 1
      }
    }
  });
  const source = proposal?.revisions[0];
  if (!proposal || !source) {
    throw new Error("La propuesta no tiene una revision para duplicar.");
  }
  if (!source.lockedAt) {
    throw new Error("Ya existe una revision editable para esta propuesta.");
  }
  if (proposal.status === "ACCEPTED") {
    throw new Error("No puedes crear una revision de una propuesta ya aceptada.");
  }

  await database.$transaction(async (transaction) => {
    const revision = await transaction.proposalRevision.create({
      data: {
        authorId: admin.id,
        introduction: source.introduction,
        investment: source.investment,
        proposalId,
        revision: source.revision + 1,
        taxIncluded: source.taxIncluded,
        terms: source.terms,
        title: source.title
      }
    });
    if (source.sections.length) {
      await transaction.proposalSection.createMany({
        data: source.sections.map((section) => ({
          content: section.content,
          isIncluded: section.isIncluded,
          metadata: section.metadata ?? undefined,
          position: section.position,
          revisionId: revision.id,
          title: section.title,
          type: section.type
        }))
      });
    }
    if (source.options.length) {
      await transaction.proposalOption.createMany({
        data: source.options.map((option) => ({
          code: option.code,
          description: option.description,
          investment: option.investment,
          position: option.position,
          recommended: option.recommended,
          revisionId: revision.id,
          taxIncluded: option.taxIncluded,
          title: option.title
        }))
      });
    }
    await transaction.proposal.update({
      where: { id: proposalId },
      data: { status: "DRAFT" }
    });
    await transaction.proposalEvent.create({
      data: {
        adminActorId: admin.id,
        metadata: { copiedFrom: source.id, revision: revision.revision },
        proposalId,
        revisionId: revision.id,
        type: "REVISION_CREATED"
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  revalidatePath(`/admin/propuestas/${proposalId}`);
}

export async function updateEditableProposalRevision(
  revisionId: string,
  _previousState: ProposalRevisionState,
  formData: FormData
): Promise<ProposalRevisionState> {
  await requireCurrentAdmin();
  const parsed = revisionInput.safeParse({
    introduction: formData.get("introduction") ?? "",
    investment: formData.get("investment") ?? "",
    terms: formData.get("terms") ?? "",
    title: formData.get("title")
  });
  if (!parsed.success) {
    return { error: "Revisa los datos de la revision antes de guardar." };
  }
  const investment = parsed.data.investment ? Number(parsed.data.investment) : null;
  if (investment !== null && (!Number.isFinite(investment) || investment < 0)) {
    return { error: "La inversion debe ser un numero positivo." };
  }

  const revision = await database.proposalRevision.findUnique({
    where: { id: revisionId },
    select: { lockedAt: true, proposalId: true }
  });
  if (!revision || revision.lockedAt) {
    return { error: "Esta revision ya esta bloqueada y no se puede alterar." };
  }

  await database.$transaction([
    database.proposalRevision.update({
      where: { id: revisionId },
      data: {
        introduction: parsed.data.introduction || null,
        investment,
        terms: parsed.data.terms || null,
        title: parsed.data.title
      }
    }),
    database.proposalSection.updateMany({
      where: { revisionId, type: "CONTEXT" },
      data: { content: parsed.data.introduction || null }
    }),
    database.proposal.update({
      where: { id: revision.proposalId },
      data: { title: parsed.data.title }
    })
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  revalidatePath(`/admin/propuestas/${revision.proposalId}`);
  return {
    success: "Revision guardada. Comparte una nueva invitacion cuando este lista."
  };
}

export async function revokeActiveProposalInvites(proposalId: string) {
  const admin = await requireCurrentAdmin();
  const proposal = await database.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, revisions: { orderBy: { revision: "desc" }, take: 1 } }
  });
  if (!proposal) {
    throw new Error("Propuesta no encontrada.");
  }

  const now = new Date();
  const revoked = await database.proposalInvite.updateMany({
    where: { proposalId, status: "ACTIVE" },
    data: { revokedAt: now, status: "REVOKED" }
  });
  if (revoked.count) {
    await database.proposalEvent.create({
      data: {
        adminActorId: admin.id,
        metadata: { count: revoked.count, reason: "manual_revoke" },
        proposalId,
        revisionId: proposal.revisions[0]?.id,
        type: "REVOKED"
      }
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  revalidatePath(`/admin/propuestas/${proposalId}`);
}
