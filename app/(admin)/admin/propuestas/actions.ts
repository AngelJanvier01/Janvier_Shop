"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  assertProposalCanCreateRevision,
  assertProposalCanShare,
  createDraftProposalState,
  proposalStatus,
  transitionProposal,
  ProposalStateError
} from "@/lib/proposals/proposal-state";
import { createProposalInviteCredentials } from "@/lib/proposals/invite-security";

const proposalInput = z.object({
  clientEmail: z.string().email().max(320),
  clientName: z.string().trim().min(2).max(160),
  companyName: z.string().trim().max(160).optional(),
  context: z.string().trim().min(12).max(4000),
  title: z.string().trim().min(4).max(180)
});

const proposalSectionTypes = [
  "CONTEXT",
  "SCOPE",
  "DELIVERABLES",
  "TIMELINE",
  "INVESTMENT",
  "TERMS",
  "REFERENCE",
  "CUSTOM"
] as const;

const proposalLineItemTypes = [
  "ONE_TIME",
  "MONTHLY",
  "ANNUAL",
  "INCLUDED",
  "OPTIONAL"
] as const;

const proposalSectionInput = z.object({
  content: z.string().trim().max(6000).optional().nullable(),
  isIncluded: z.boolean(),
  title: z.string().trim().min(2).max(140),
  type: z.enum(proposalSectionTypes)
});

const proposalOptionInput = z.object({
  code: z.string().trim().min(2).max(24),
  description: z.string().trim().max(2000).optional().nullable(),
  investment: z.string().trim().max(40).optional().nullable(),
  isEnabled: z.boolean(),
  recommended: z.boolean(),
  taxIncluded: z.boolean(),
  title: z.string().trim().min(2).max(140)
});

const proposalLineItemInput = z.object({
  code: z.string().trim().min(2).max(40),
  description: z.string().trim().min(2).max(1000),
  discount: z.string().trim().max(40),
  internalCost: z.string().trim().max(40).optional().nullable(),
  internalNotes: z.string().trim().max(2000).optional().nullable(),
  markupPercent: z.string().trim().max(40).optional().nullable(),
  optionCode: z.string().trim().max(24).optional().nullable(),
  quantity: z.string().trim().max(40),
  taxRate: z.string().trim().max(40),
  type: z.enum(proposalLineItemTypes),
  unitPrice: z.string().trim().max(40),
  visibleForClient: z.boolean()
});

const revisionInput = z.object({
  introduction: z.string().trim().max(4000),
  investment: z.string().trim().max(40),
  lineItems: z.string().max(100000),
  options: z.string().max(50000),
  sections: z.string().max(100000),
  taxIncluded: z.string().optional(),
  terms: z.string().trim().max(4000),
  title: z.string().trim().min(4).max(180)
});

type CreateProposalState = {
  error?: string;
  proposalId?: string;
  success?: string;
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

function parseStructuredRevisionField<T>(
  rawValue: string,
  schema: z.ZodType<T>
): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(rawValue));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parseDecimal(
  value: string | null | undefined,
  options: { allowEmpty?: boolean; maximum?: number; minimum?: number } = {}
) {
  if (!value) {
    return options.allowEmpty ? null : undefined;
  }
  const amount = Number(value);
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 1000000000;
  return Number.isFinite(amount) && amount >= minimum && amount <= maximum
    ? value
    : undefined;
}

function invalidateProposalPaths(proposalId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  revalidatePath(`/admin/propuestas/${proposalId}`);
}

export async function createProposal(
  _previousState: CreateProposalState,
  formData: FormData
): Promise<CreateProposalState> {
  void _previousState;
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
  const proposal = await database.$transaction(async (transaction) => {
    const email = input.clientEmail.toLowerCase();
    const client =
      (await transaction.client.findFirst({
        orderBy: { updatedAt: "desc" },
        where: { email }
      })) ??
      (await transaction.client.create({
        data: {
          companyName: input.companyName || null,
          contactName: input.clientName,
          email
        }
      }));
    const draft = await transaction.proposal.create({
      data: {
        ...createDraftProposalState(),
        clientId: client.id,
        ownerId: admin.id,
        reference: reference(),
        title: input.title
      }
    });
    const revision = await transaction.proposalRevision.create({
      data: {
        authorId: admin.id,
        introduction: input.context,
        proposalId: draft.id,
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
        proposalId: draft.id,
        revisionId: revision.id,
        type: "PROPOSAL_CREATED"
      }
    });
    return draft;
  });

  invalidateProposalPaths(proposal.id);
  return {
    proposalId: proposal.id,
    success: "Borrador creado. Completa la revisión y comparte sólo cuando esté lista."
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
      revisions: {
        include: { options: true, sections: true },
        orderBy: { revision: "desc" },
        take: 1
      }
    }
  });
  const revision = proposal?.revisions[0];
  if (!proposal || !revision) {
    return { error: "No encontramos una revisión disponible para esta propuesta." };
  }
  if (proposal.status === proposalStatus.DRAFT) {
    try {
      assertProposalCanShare(proposal.status);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "No se puede compartir." };
    }
    if (revision.lockedAt || !revision.sections.some((section) => section.isIncluded)) {
      return { error: "Incluye al menos un bloque antes de compartir la propuesta." };
    }
  } else if (
    proposal.status !== proposalStatus.SENT &&
    proposal.status !== proposalStatus.VIEWED
  ) {
    return { error: "Esta propuesta ya no puede compartirse ni rotar su acceso." };
  }

  const credentials = await createProposalInviteCredentials();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  try {
    await database.$transaction(async (transaction) => {
      const currentProposal = await transaction.proposal.findUnique({
        where: { id: proposalId },
        select: { status: true }
      });
      if (
        !currentProposal ||
        (currentProposal.status !== proposalStatus.DRAFT &&
          currentProposal.status !== proposalStatus.SENT &&
          currentProposal.status !== proposalStatus.VIEWED)
      ) {
        throw new ProposalStateError(
          "La propuesta cambió de estado y ya no puede compartirse ni rotar su acceso."
        );
      }
      if (currentProposal.status !== proposal.status) {
        throw new ProposalStateError(
          "La propuesta cambió mientras se preparaba el acceso. Actualiza la página."
        );
      }
      if (currentProposal.status === proposalStatus.DRAFT) {
        const currentRevision = await transaction.proposalRevision.findUnique({
          where: { id: revision.id },
          select: { lockedAt: true }
        });
        if (!currentRevision || currentRevision.lockedAt) {
          throw new ProposalStateError("La revisión ya fue compartida.");
        }
      }
      const revoked = await transaction.proposalInvite.updateMany({
        where: { proposalId, status: "ACTIVE" },
        data: { revokedAt: now, status: "REVOKED" }
      });
      if (revoked.count) {
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: { count: revoked.count, reason: "new_invite_issued" },
            proposalId,
            revisionId: revision.id,
            type: "INVITE_REVOKED"
          }
        });
      }
      if (proposal.status === proposalStatus.DRAFT) {
        await transaction.proposalRevision.update({
          where: { id: revision.id },
          data: { lockedAt: now, sharedAt: now }
        });
        await transaction.proposalRevision.updateMany({
          where: { id: { not: revision.id }, proposalId, sharedAt: { not: null } },
          data: { replacedAt: now }
        });
        await transaction.proposal.update({
          where: { id: proposalId },
          data: {
            ...transitionProposal(proposal.status, proposalStatus.SENT),
            selectedOptionId: null,
            sentAt: now,
            validUntil: expiresAt
          }
        });
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            proposalId,
            revisionId: revision.id,
            type: "REVISION_SHARED"
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
      await transaction.proposalEvent.create({
        data: {
          adminActorId: admin.id,
          metadata: { inviteId: invite.id },
          proposalId,
          revisionId: revision.id,
          type: "INVITE_CREATED"
        }
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo emitir la invitación."
    };
  }

  invalidateProposalPaths(proposalId);
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
          lineItems: true,
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
    throw new Error("La propuesta no tiene una revisión para duplicar.");
  }
  assertProposalCanCreateRevision(proposal.status);
  if (!source.lockedAt) {
    throw new Error("Ya existe una revisión editable para esta propuesta.");
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
    const optionIds = new Map<string, string>();
    for (const option of source.options) {
      const nextOption = await transaction.proposalOption.create({
        data: {
          code: option.code,
          description: option.description,
          investment: option.investment,
          isEnabled: option.isEnabled,
          position: option.position,
          recommended: option.recommended,
          revisionId: revision.id,
          taxIncluded: option.taxIncluded,
          title: option.title
        }
      });
      optionIds.set(option.id, nextOption.id);
    }
    if (source.lineItems.length) {
      await transaction.proposalLineItem.createMany({
        data: source.lineItems.map((lineItem) => ({
          code: lineItem.code,
          description: lineItem.description,
          discount: lineItem.discount,
          internalCost: lineItem.internalCost,
          internalNotes: lineItem.internalNotes,
          markupPercent: lineItem.markupPercent,
          optionId: lineItem.optionId ? (optionIds.get(lineItem.optionId) ?? null) : null,
          position: lineItem.position,
          quantity: lineItem.quantity,
          revisionId: revision.id,
          taxRate: lineItem.taxRate,
          type: lineItem.type,
          unitPrice: lineItem.unitPrice,
          visibleForClient: lineItem.visibleForClient
        }))
      });
    }
    await transaction.proposal.update({
      where: { id: proposalId },
      data: {
        ...transitionProposal(proposal.status, proposalStatus.DRAFT),
        selectedOptionId: null
      }
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

  invalidateProposalPaths(proposalId);
}

export async function updateEditableProposalRevision(
  revisionId: string,
  _previousState: ProposalRevisionState,
  formData: FormData
): Promise<ProposalRevisionState> {
  void _previousState;
  const admin = await requireCurrentAdmin();
  const parsed = revisionInput.safeParse({
    introduction: formData.get("introduction") ?? "",
    investment: formData.get("investment") ?? "",
    lineItems: formData.get("lineItems") ?? "[]",
    options: formData.get("options") ?? "[]",
    sections: formData.get("sections") ?? "[]",
    taxIncluded: formData.get("taxIncluded") ?? undefined,
    terms: formData.get("terms") ?? "",
    title: formData.get("title")
  });
  if (!parsed.success) {
    return { error: "Revisa los datos de la revisión antes de guardar." };
  }
  const investment = parseDecimal(parsed.data.investment, { allowEmpty: true });
  const sections = parseStructuredRevisionField(
    parsed.data.sections,
    z.array(proposalSectionInput).min(1).max(12)
  );
  const options = parseStructuredRevisionField(
    parsed.data.options,
    z.array(proposalOptionInput).max(8)
  );
  const lineItems = parseStructuredRevisionField(
    parsed.data.lineItems,
    z.array(proposalLineItemInput).max(40)
  );
  if (investment === undefined || !sections || !options || !lineItems) {
    return {
      error: "Revisa importes, bloques, alternativas y conceptos antes de guardar."
    };
  }
  const optionCodes = new Set<string>();
  for (const option of options) {
    const code = option.code.toUpperCase();
    if (
      optionCodes.has(code) ||
      parseDecimal(option.investment, { allowEmpty: true }) === undefined
    ) {
      return { error: "Cada alternativa necesita un código único y un importe válido." };
    }
    optionCodes.add(code);
  }
  const lineCodes = new Set<string>();
  for (const lineItem of lineItems) {
    const values = [
      parseDecimal(lineItem.quantity, { minimum: 0.001 }),
      parseDecimal(lineItem.unitPrice),
      parseDecimal(lineItem.discount),
      parseDecimal(lineItem.taxRate, { maximum: 100 }),
      parseDecimal(lineItem.internalCost, { allowEmpty: true }),
      parseDecimal(lineItem.markupPercent, { allowEmpty: true, maximum: 10000 })
    ];
    if (
      lineCodes.has(lineItem.code.toUpperCase()) ||
      values.some((value) => value === undefined) ||
      (lineItem.optionCode && !optionCodes.has(lineItem.optionCode.toUpperCase()))
    ) {
      return {
        error:
          "Cada concepto requiere importes válidos, código único y alternativa existente."
      };
    }
    lineCodes.add(lineItem.code.toUpperCase());
  }

  const revision = await database.proposalRevision.findUnique({
    where: { id: revisionId },
    include: { proposal: { select: { status: true } } }
  });
  if (
    !revision ||
    revision.lockedAt ||
    revision.proposal.status !== proposalStatus.DRAFT
  ) {
    return { error: "Esta revisión ya no es un borrador editable." };
  }

  try {
    await database.$transaction(async (transaction) => {
      const currentRevision = await transaction.proposalRevision.findUnique({
        where: { id: revisionId },
        include: { proposal: { select: { status: true } } }
      });
      if (
        !currentRevision ||
        currentRevision.lockedAt ||
        currentRevision.proposal.status !== proposalStatus.DRAFT
      ) {
        throw new ProposalStateError("Esta revisión ya no es un borrador editable.");
      }
      await transaction.proposalLineItem.deleteMany({ where: { revisionId } });
      await transaction.proposalSection.deleteMany({ where: { revisionId } });
      await transaction.proposalOption.deleteMany({ where: { revisionId } });
      await transaction.proposalRevision.update({
        where: { id: revisionId },
        data: {
          introduction: parsed.data.introduction || null,
          investment,
          taxIncluded: parsed.data.taxIncluded === "true",
          terms: parsed.data.terms || null,
          title: parsed.data.title
        }
      });
      await transaction.proposalSection.createMany({
        data: sections.map((section, position) => ({
          content: section.content || null,
          isIncluded: section.isIncluded,
          position: position + 1,
          revisionId,
          title: section.title,
          type: section.type
        }))
      });
      const optionIds = new Map<string, string>();
      for (const [position, option] of options.entries()) {
        const createdOption = await transaction.proposalOption.create({
          data: {
            code: option.code.toUpperCase(),
            description: option.description || null,
            investment: parseDecimal(option.investment, { allowEmpty: true }),
            isEnabled: option.isEnabled,
            position: position + 1,
            recommended: option.recommended,
            revisionId,
            taxIncluded: option.taxIncluded,
            title: option.title
          }
        });
        optionIds.set(createdOption.code, createdOption.id);
      }
      if (lineItems.length) {
        await transaction.proposalLineItem.createMany({
          data: lineItems.map((lineItem, position) => ({
            code: lineItem.code.toUpperCase(),
            description: lineItem.description,
            discount: parseDecimal(lineItem.discount) ?? "0",
            internalCost: parseDecimal(lineItem.internalCost, { allowEmpty: true }),
            internalNotes: lineItem.internalNotes || null,
            markupPercent: parseDecimal(lineItem.markupPercent, {
              allowEmpty: true,
              maximum: 10000
            }),
            optionId: lineItem.optionCode
              ? (optionIds.get(lineItem.optionCode.toUpperCase()) ?? null)
              : null,
            position: position + 1,
            quantity: parseDecimal(lineItem.quantity, { minimum: 0.001 }) ?? "1",
            revisionId,
            taxRate: parseDecimal(lineItem.taxRate, { maximum: 100 }) ?? "0",
            type: lineItem.type,
            unitPrice: parseDecimal(lineItem.unitPrice) ?? "0",
            visibleForClient: lineItem.visibleForClient
          }))
        });
      }
      await transaction.proposal.update({
        where: { id: revision.proposalId },
        data: { title: parsed.data.title }
      });
      await transaction.proposalEvent.create({
        data: {
          adminActorId: admin.id,
          proposalId: revision.proposalId,
          revisionId,
          type: "PROPOSAL_EDITED"
        }
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar el borrador."
    };
  }

  invalidateProposalPaths(revision.proposalId);
  return { success: "Borrador guardado. Compártelo sólo cuando esté listo." };
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
        type: "INVITE_REVOKED"
      }
    });
  }

  invalidateProposalPaths(proposalId);
}
