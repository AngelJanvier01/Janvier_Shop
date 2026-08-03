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
import {
  analyzeMarkdownDraft,
  MarkdownDraftConflictError,
  MarkdownDraftNotEditableError,
  persistMarkdownDraft,
  type MarkdownDraftSourceState,
  type MarkdownDraftWriteReason
} from "@/lib/proposals/markdown/drafts";
import { createCompleteProposalDraftTemplate } from "@/lib/proposals/markdown/complete-draft-template";
import {
  buildAdminJanvierDocument,
  buildFrozenProposalEvidence,
  buildPublicJanvierDocument,
  janvierDocumentSchema,
  parseJanvierMarkdown
} from "@/lib/proposals/markdown";
import {
  diffMarkdownSources,
  getMarkdownTemplate,
  type MarkdownLineDiff
} from "@/lib/proposals/markdown/history";
import { validateMarkdownUploadMetadata } from "@/lib/proposals/markdown/upload-metadata";
import {
  getProposalAssetShareBlockers,
  getProposalMarkdownAssetReport,
  publicAssetManifest,
  type MarkdownAssetReport
} from "@/lib/proposals/assets";
import {
  assertPublicCommercialPrivacy,
  buildPublicProposalCommercialDto
} from "@/lib/proposals/commercial-dto";

function formatFrozenDocumentDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(date);
}

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
  "HOURLY",
  "PER_USER",
  "PER_DEVICE",
  "PER_LOCATION",
  "PER_SITE",
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

export type MarkdownCandidateState = {
  candidate?: {
    diagnostics: Array<{
      code: string;
      column: number;
      line: number;
      message: string;
      severity: "ERROR" | "WARNING" | "INFO";
    }>;
    assetReport: MarkdownAssetReport | null;
    document: ReturnType<typeof analyzeMarkdownDraft>["document"];
    mimeType: string | null;
    originalFileName: string | null;
    size: number | null;
    sourceHash: string;
    sourceKind: "FILE" | "PASTE";
    sourceMarkdown: string;
    status: "VALID" | "WARNINGS" | "ERROR";
  };
  error?: string;
};

export type MarkdownDraftSaveState = {
  diagnostics?: MarkdownCandidateState["candidate"] extends infer Candidate
    ? Candidate extends { diagnostics: infer Diagnostics }
      ? Diagnostics
      : never
    : never;
  error?: string;
  source?: MarkdownDraftSourceState;
  success?: string;
};

export type MarkdownHistoryMutationState = {
  error?: string;
  source?: MarkdownDraftSourceState;
  success?: string;
};

export type MarkdownCheckpointDiffState = {
  checkpointHash: string;
  diff: MarkdownLineDiff[];
  sourceHash: string;
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

function fileFromFormData(value: FormDataEntryValue | null): File | null {
  return value && typeof value === "object" && "arrayBuffer" in value && "name" in value
    ? (value as File)
    : null;
}

async function assertMarkdownRevisionIsEditable(revisionId: string) {
  const revision = await database.proposalRevision.findUnique({
    include: { proposal: { select: { status: true } } },
    where: { id: revisionId }
  });
  if (
    !revision ||
    revision.lockedAt ||
    revision.proposal.status !== proposalStatus.DRAFT
  ) {
    throw new MarkdownDraftNotEditableError();
  }
  return revision;
}

function markdownErrorMessage(
  diagnostics: MarkdownCandidateState["candidate"] extends infer Candidate
    ? Candidate extends { diagnostics: infer Diagnostics }
      ? Diagnostics
      : never
    : never
) {
  const firstError = diagnostics.find((item) => item.severity === "ERROR");
  return firstError?.message ?? "El documento Markdown no se puede guardar todavía.";
}

function nullableExpectedHash(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  return /^[a-f0-9]{64}$/u.test(value) ? value : undefined;
}

function nullableExpectedVersion(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function parseDraftWriteForm(formData: FormData) {
  const sourceMarkdown = formData.get("markdown");
  const sourceHash = formData.get("sourceHash");
  const expectedSourceHash = nullableExpectedHash(formData.get("expectedSourceHash"));
  const expectedVersion = nullableExpectedVersion(formData.get("expectedVersion"));
  const sourceKind = formData.get("sourceKind") === "FILE" ? "FILE" : "PASTE";
  const originalFileName = formData.get("originalFileName");
  const mimeType = formData.get("mimeType");
  const size = formData.get("size");
  if (
    typeof sourceMarkdown !== "string" ||
    typeof sourceHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(sourceHash) ||
    expectedSourceHash === undefined ||
    expectedVersion === undefined ||
    (originalFileName !== null && typeof originalFileName !== "string")
  ) {
    return null;
  }
  if (sourceKind === "FILE") {
    const fileName = typeof originalFileName === "string" ? originalFileName : "";
    const parsedSize = typeof size === "string" ? Number(size) : Number.NaN;
    const validation = validateMarkdownUploadMetadata({
      fileName,
      mimeType: typeof mimeType === "string" ? mimeType : "",
      size: parsedSize
    });
    if (!validation.ok) {
      return {
        error: validation.issues[0]?.message ?? "El archivo Markdown no es válido."
      };
    }
  }
  return {
    expectedSourceHash,
    expectedVersion,
    originalFileName:
      typeof originalFileName === "string" && originalFileName.trim()
        ? originalFileName.trim()
        : null,
    sourceHash,
    sourceKind,
    sourceMarkdown
  };
}

export async function analyzeMarkdownCandidate(
  revisionId: string,
  _previousState: MarkdownCandidateState,
  formData: FormData
): Promise<MarkdownCandidateState> {
  void _previousState;
  await requireCurrentAdmin();
  try {
    await assertMarkdownRevisionIsEditable(revisionId);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se puede analizar esta revisión."
    };
  }

  const file = fileFromFormData(formData.get("markdownFile"));
  let sourceKind: "FILE" | "PASTE" = "PASTE";
  let originalFileName: string | null = null;
  let mimeType: string | null = null;
  let size: number | null = null;
  let sourceMarkdown: string | Uint8Array;
  if (file && file.size > 0) {
    sourceKind = "FILE";
    originalFileName = file.name;
    mimeType = file.type || "application/octet-stream";
    size = file.size;
    const metadata = validateMarkdownUploadMetadata({
      fileName: originalFileName,
      mimeType,
      size
    });
    if (!metadata.ok) {
      return {
        error: metadata.issues[0]?.message ?? "El archivo Markdown no es válido."
      };
    }
    sourceMarkdown = new Uint8Array(await file.arrayBuffer());
  } else {
    const pasted = formData.get("markdown");
    sourceMarkdown = typeof pasted === "string" ? pasted : "";
    originalFileName = "pasted-markdown.md";
  }

  const analyzed = analyzeMarkdownDraft(sourceMarkdown);
  const assetReport =
    analyzed.status === "ERROR"
      ? null
      : await getProposalMarkdownAssetReport(revisionId, analyzed.document).catch(
          () => null
        );
  return {
    candidate: {
      assetReport,
      diagnostics: analyzed.diagnostics,
      document: analyzed.document,
      mimeType,
      originalFileName,
      size,
      sourceHash: analyzed.sourceHash,
      sourceKind,
      sourceMarkdown: analyzed.normalizedSource,
      status: analyzed.status
    }
  };
}

async function persistMarkdownDraftFromForm(
  revisionId: string,
  formData: FormData,
  reason: MarkdownDraftWriteReason
): Promise<MarkdownDraftSaveState> {
  const input = parseDraftWriteForm(formData);
  if (!input || "error" in input) {
    return {
      error:
        input && "error" in input ? input.error : "La solicitud Markdown no es válida."
    };
  }
  const analyzed = analyzeMarkdownDraft(input.sourceMarkdown);
  if (analyzed.status === "ERROR") {
    return {
      diagnostics: analyzed.diagnostics,
      error: markdownErrorMessage(analyzed.diagnostics)
    };
  }
  try {
    const admin = await requireCurrentAdmin();
    const source = await persistMarkdownDraft(revisionId, admin.id, {
      ...input,
      reason
    });
    const revision = await database.proposalRevision.findUnique({
      select: { proposalId: true },
      where: { id: revisionId }
    });
    if (revision) {
      invalidateProposalPaths(revision.proposalId);
    }
    return {
      source,
      success:
        reason === "MANUAL_SAVE"
          ? "Borrador Markdown guardado automáticamente."
          : "Markdown confirmado y sincronizado con la revisión."
    };
  } catch (error) {
    const isUniqueConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002";
    return {
      error:
        error instanceof MarkdownDraftConflictError
          ? error.message
          : isUniqueConflict
            ? "La fuente cambió en otra sesión. Actualiza antes de guardar."
            : error instanceof Error
              ? error.message
              : "No se pudo guardar el borrador Markdown."
    };
  }
}

export async function confirmMarkdownDraft(
  revisionId: string,
  _previousState: MarkdownDraftSaveState,
  formData: FormData
): Promise<MarkdownDraftSaveState> {
  void _previousState;
  return persistMarkdownDraftFromForm(revisionId, formData, "REIMPORT_REPLACE");
}

export async function autosaveMarkdownDraft(
  revisionId: string,
  payload: {
    expectedSourceHash: string;
    expectedVersion: number;
    originalFileName: string | null;
    sourceMarkdown: string;
  }
): Promise<MarkdownDraftSaveState> {
  const analyzed = analyzeMarkdownDraft(payload.sourceMarkdown);
  const formData = new FormData();
  formData.set("expectedSourceHash", payload.expectedSourceHash);
  formData.set("expectedVersion", String(payload.expectedVersion));
  formData.set("markdown", payload.sourceMarkdown);
  formData.set("originalFileName", payload.originalFileName ?? "pasted-markdown.md");
  formData.set("sourceHash", analyzed.sourceHash);
  formData.set("sourceKind", "PASTE");
  return persistMarkdownDraftFromForm(revisionId, formData, "MANUAL_SAVE");
}

async function persistMarkdownHistorySource(input: {
  originalFileName: string;
  reason: Extract<MarkdownDraftWriteReason, "RESTORE" | "TEMPLATE_APPLIED">;
  revisionId: string;
  sourceMarkdown: string;
}): Promise<MarkdownHistoryMutationState> {
  const admin = await requireCurrentAdmin();
  const revision = await database.proposalRevision.findUnique({
    include: { markdownSource: true, proposal: { select: { status: true } } },
    where: { id: input.revisionId }
  });
  if (
    !revision ||
    revision.lockedAt ||
    revision.proposal.status !== proposalStatus.DRAFT
  ) {
    return { error: "Esta revisión ya no es un borrador editable." };
  }
  const analyzed = analyzeMarkdownDraft(input.sourceMarkdown);
  if (analyzed.status === "ERROR") {
    return {
      error: "El checkpoint no cumple el parser vigente y no puede restaurarse."
    };
  }
  try {
    const source = await persistMarkdownDraft(input.revisionId, admin.id, {
      expectedSourceHash: revision.markdownSource?.sourceHash ?? null,
      expectedVersion: revision.markdownSource?.version ?? null,
      originalFileName: input.originalFileName,
      reason: input.reason,
      sourceHash: analyzed.sourceHash,
      sourceMarkdown: analyzed.normalizedSource
    });
    invalidateProposalPaths(revision.proposalId);
    return {
      source,
      success:
        input.reason === "RESTORE"
          ? "Checkpoint restaurado y validado con el parser vigente."
          : "Plantilla aplicada como un nuevo checkpoint editable."
    };
  } catch (error) {
    return {
      error:
        error instanceof MarkdownDraftConflictError
          ? error.message
          : error instanceof Error
            ? error.message
            : "No se pudo actualizar el historial Markdown."
    };
  }
}

export async function getMarkdownCheckpointDiff(
  revisionId: string,
  checkpointId: string
): Promise<MarkdownCheckpointDiffState> {
  await requireCurrentAdmin();
  const checkpoint = await database.proposalMarkdownCheckpoint.findFirst({
    select: { sourceHash: true, sourceMarkdown: true },
    where: { id: checkpointId, source: { revisionId } }
  });
  const current = await database.proposalMarkdownSource.findUnique({
    select: { sourceHash: true, sourceMarkdown: true },
    where: { revisionId }
  });
  if (!checkpoint || !current) {
    throw new Error("No se encontró el checkpoint dentro de esta revisión.");
  }
  return {
    checkpointHash: checkpoint.sourceHash,
    diff: diffMarkdownSources(checkpoint.sourceMarkdown, current.sourceMarkdown),
    sourceHash: current.sourceHash
  };
}

export async function restoreMarkdownCheckpoint(
  revisionId: string,
  _previousState: MarkdownHistoryMutationState,
  formData: FormData
): Promise<MarkdownHistoryMutationState> {
  void _previousState;
  const checkpointId = formData.get("checkpointId");
  if (typeof checkpointId !== "string" || !checkpointId) {
    return { error: "Selecciona un checkpoint válido." };
  }
  await requireCurrentAdmin();
  const checkpoint = await database.proposalMarkdownCheckpoint.findFirst({
    select: { originalFileName: true, sourceMarkdown: true },
    where: { id: checkpointId, source: { revisionId } }
  });
  if (!checkpoint) {
    return { error: "El checkpoint no pertenece a esta propuesta." };
  }
  return persistMarkdownHistorySource({
    originalFileName: checkpoint.originalFileName ?? "restored-markdown.md",
    reason: "RESTORE",
    revisionId,
    sourceMarkdown: checkpoint.sourceMarkdown
  });
}

export async function applyMarkdownTemplate(
  revisionId: string,
  _previousState: MarkdownHistoryMutationState,
  formData: FormData
): Promise<MarkdownHistoryMutationState> {
  void _previousState;
  const templateId = formData.get("templateId");
  const template =
    typeof templateId === "string" ? getMarkdownTemplate(templateId) : null;
  if (!template) {
    return { error: "La plantilla solicitada no está disponible." };
  }
  return persistMarkdownHistorySource({
    originalFileName: `template-${template.id}.md`,
    reason: "TEMPLATE_APPLIED",
    revisionId,
    sourceMarkdown: template.sourceMarkdown
  });
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
  const sourceMarkdown = createCompleteProposalDraftTemplate(input);
  const analyzedTemplate = analyzeMarkdownDraft(sourceMarkdown);
  if (analyzedTemplate.status === "ERROR") {
    return { error: "La plantilla inicial de JANVIER no superó la validación segura." };
  }

  const created = await database.$transaction(async (transaction) => {
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
    return { draft, revision };
  });

  await persistMarkdownDraft(created.revision.id, admin.id, {
    expectedSourceHash: null,
    expectedVersion: null,
    originalFileName: "janvier-complete-draft.md",
    reason: "IMPORT",
    sourceHash: analyzedTemplate.sourceHash,
    sourceMarkdown: analyzedTemplate.normalizedSource
  });

  invalidateProposalPaths(created.draft.id);
  return {
    proposalId: created.draft.id,
    success:
      "Borrador creado con la plantilla completa. Reemplaza los ejemplos antes de compartir."
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
      owner: { select: { name: true } },
      revisions: {
        include: {
          assets: { include: { blob: true }, orderBy: { createdAt: "asc" } },
          lineItems: { orderBy: { position: "asc" } },
          markdownSource: true,
          options: { orderBy: { position: "asc" } },
          paymentStages: {
            include: { option: { select: { code: true } } },
            orderBy: { position: "asc" }
          },
          sections: { orderBy: { position: "asc" } },
          timelinePhases: {
            include: {
              deliverables: { orderBy: { position: "asc" } },
              dependencies: {
                include: { dependsOnPhase: { select: { code: true } } }
              },
              option: { select: { code: true } }
            },
            orderBy: { position: "asc" }
          }
        },
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
    const missingRequiredAssets = await getProposalAssetShareBlockers(revision.id);
    if (missingRequiredAssets.length) {
      return {
        error: `No se puede compartir: faltan o no están referenciados los activos requeridos (${missingRequiredAssets.join(", ")}).`
      };
    }
  } else if (
    proposal.status !== proposalStatus.SENT &&
    proposal.status !== proposalStatus.VIEWED
  ) {
    return { error: "Esta propuesta ya no puede compartirse ni rotar su acceso." };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  let frozenMarkdown:
    | {
        evidenceHash: string;
        frozenPublicDocument: object;
        frozenPrivateEvidence: object;
        publicContentHash: string;
        resolvedVariables: object;
      }
    | undefined;

  if (proposal.status === proposalStatus.DRAFT && revision.markdownSource) {
    const cachedDocument = janvierDocumentSchema.safeParse(
      revision.markdownSource.normalizedAst
    );
    const reparsed = cachedDocument.success
      ? null
      : parseJanvierMarkdown(revision.markdownSource.sourceMarkdown);
    const document = cachedDocument.success ? cachedDocument.data : reparsed?.document;
    if (!document || reparsed?.status === "ERROR") {
      return {
        error: "No se puede compartir: la fuente Markdown no supera la validación segura."
      };
    }
    const commercial = buildPublicProposalCommercialDto({
      commercialCalculationVersion: revision.commercialCalculationVersion,
      currency: revision.currency,
      deliveryTerms: revision.deliveryTerms,
      lineItems: revision.lineItems.map((lineItem) => ({
        billingType: lineItem.billingType,
        code: lineItem.code,
        contingencyPercent: lineItem.contingencyPercent,
        description: lineItem.description,
        discountType: lineItem.discountType,
        discountValue: lineItem.discountValue,
        id: lineItem.id,
        internalCost: lineItem.internalCost,
        isActive: lineItem.isActive,
        isIncluded: lineItem.isIncluded,
        isOptional: lineItem.isOptional,
        isTaxable: lineItem.isTaxable,
        markupPercent: lineItem.markupPercent,
        name: lineItem.name,
        optionId: lineItem.optionId,
        pricingMode: lineItem.pricingMode,
        quantity: lineItem.quantity,
        scope: lineItem.scope,
        selectedByDefault: lineItem.selectedByDefault,
        taxIncluded: lineItem.taxIncluded,
        taxRate: lineItem.taxRate,
        unit: lineItem.unit,
        unitPrice: lineItem.unitPrice,
        visibleToClient: lineItem.visibleToClient
      })),
      options: revision.options.map((option) => ({
        code: option.code,
        conditionsSummary: option.conditionsSummary,
        description: option.description,
        estimatedDuration: option.estimatedDuration,
        id: option.id,
        isActive: option.isActive,
        recommended: option.recommended,
        supportSummary: option.supportSummary,
        title: option.title
      })),
      paymentStages: revision.paymentStages.map((stage) => ({
        calculationType: stage.calculationType,
        description: stage.description,
        dueDays: stage.dueDays,
        fixedAmount: stage.fixedAmount,
        id: stage.id,
        optionId: stage.optionId,
        option: stage.option,
        percentage: stage.percentage,
        position: stage.position,
        title: stage.title,
        triggerDescription: stage.triggerDescription,
        triggerType: stage.triggerType,
        visibleToClient: stage.visibleToClient
      })),
      paymentTermsSummary: revision.paymentTermsSummary,
      supportSummary: revision.supportSummary,
      timelinePhases: revision.timelinePhases,
      validUntil: expiresAt,
      warrantySummary: revision.warrantySummary
    });
    assertPublicCommercialPrivacy(commercial);
    const assetManifest = publicAssetManifest(
      revision.assets.map((asset) => ({
        accessUrl: `/api/proposals/assets/${asset.id}`,
        alias: asset.alias,
        altText: asset.isDecorative ? "" : asset.altText,
        height: asset.blob.height,
        isDecorative: asset.isDecorative,
        isRequired: asset.isRequired,
        mimeType: asset.blob.mimeType as "image/jpeg" | "image/png" | "image/webp",
        removed: Boolean(asset.removedAt),
        sha256: asset.blob.sha256,
        width: asset.blob.width
      }))
    );
    const removedSectionSourceIds = new Set(
      revision.sections
        .filter((section) => section.removedAt)
        .map((section) => section.sourceId)
    );
    const resolvedVariables = {
      author: { name: proposal.owner.name },
      client: {
        companyName: proposal.client.companyName,
        contactName: proposal.client.contactName,
        email: proposal.client.email
      },
      currentDate: formatFrozenDocumentDate(now),
      proposal: {
        currency: commercial.currency,
        deliveryTerms: commercial.terms.deliveryTerms,
        paymentTermsSummary: commercial.terms.paymentTermsSummary,
        reference: proposal.reference,
        supportSummary: commercial.terms.supportSummary,
        title: proposal.title,
        validUntil: formatFrozenDocumentDate(expiresAt),
        warrantySummary: commercial.terms.warrantySummary
      }
    };
    const publicDocument = buildPublicJanvierDocument(document, {
      assetManifest,
      commercial,
      mode: "CLIENT",
      removedSectionSourceIds,
      variableContext: resolvedVariables
    });
    const privateDocument = buildAdminJanvierDocument(document, {
      assetManifest: revision.assets.map((asset) => ({
        accessUrl: `/api/proposals/assets/${asset.id}`,
        alias: asset.alias,
        altText: asset.isDecorative ? "" : asset.altText,
        height: asset.blob.height,
        isDecorative: asset.isDecorative,
        isRequired: asset.isRequired,
        mimeType: asset.blob.mimeType as "image/jpeg" | "image/png" | "image/webp",
        removed: Boolean(asset.removedAt),
        sha256: asset.blob.sha256,
        width: asset.blob.width
      })),
      commercial,
      removedSectionSourceIds,
      variableContext: resolvedVariables
    });
    const evidence = buildFrozenProposalEvidence({
      fullAssetManifest: revision.assets.map((asset) => ({
        alias: asset.alias,
        id: asset.id,
        removedAt: asset.removedAt?.toISOString() ?? null,
        sha256: asset.blob.sha256
      })),
      generation: {
        generatedAt: now.toISOString(),
        rendererVersion: "janvier-renderer-v1"
      },
      normalizedAst: document,
      privateDocument,
      publicDocument,
      publicFacts: {
        alternative: null,
        commercial,
        currency: commercial.currency,
        revision: revision.revision,
        validUntil: expiresAt.toISOString()
      },
      resolvedVariables,
      sourceHash: revision.markdownSource.sourceHash,
      sourceMarkdown: revision.markdownSource.sourceMarkdown,
      parserVersion: revision.markdownSource.parserVersion
    });
    frozenMarkdown = {
      evidenceHash: evidence.evidenceHash,
      frozenPrivateEvidence: evidence.privateEvidence,
      frozenPublicDocument: {
        commercial,
        document: publicDocument,
        publicContentHash: evidence.publicContentHash,
        resolvedVariables,
        revision: revision.revision,
        validUntil: expiresAt.toISOString(),
        version: "markdown-first-v1"
      },
      publicContentHash: evidence.publicContentHash,
      resolvedVariables
    };
  }

  const credentials = await createProposalInviteCredentials();
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
        if (frozenMarkdown && revision.markdownSource) {
          const currentSource = await transaction.proposalMarkdownSource.findUnique({
            where: { id: revision.markdownSource.id },
            select: { sourceHash: true }
          });
          if (
            !currentSource ||
            currentSource.sourceHash !== revision.markdownSource.sourceHash
          ) {
            throw new ProposalStateError(
              "La fuente Markdown cambió mientras se congelaba. Actualiza la propuesta e inténtalo de nuevo."
            );
          }
          const latestCheckpoint = await transaction.proposalMarkdownCheckpoint.findFirst(
            {
              orderBy: { sequence: "desc" },
              select: { sequence: true },
              where: { sourceId: revision.markdownSource.id }
            }
          );
          await transaction.proposalMarkdownCheckpoint.create({
            data: {
              createdByAdminId: admin.id,
              originalFileName: revision.markdownSource.originalFileName,
              parseStatus: revision.markdownSource.parseStatus,
              parseWarnings: revision.markdownSource.parseWarnings ?? undefined,
              parserVersion: revision.markdownSource.parserVersion,
              reason: "PRE_SHARE",
              sequence: (latestCheckpoint?.sequence ?? 0) + 1,
              sourceHash: revision.markdownSource.sourceHash,
              sourceId: revision.markdownSource.id,
              sourceMarkdown: revision.markdownSource.sourceMarkdown
            }
          });
        }
        await transaction.proposalRevision.update({
          where: { id: revision.id },
          data: {
            ...(frozenMarkdown
              ? {
                  evidenceHash: frozenMarkdown.evidenceHash,
                  frozenAt: now,
                  frozenPrivateEvidence: frozenMarkdown.frozenPrivateEvidence,
                  frozenPublicDocument: frozenMarkdown.frozenPublicDocument,
                  publicContentHash: frozenMarkdown.publicContentHash,
                  resolvedVariables: frozenMarkdown.resolvedVariables
                }
              : {}),
            lockedAt: now,
            sharedAt: now
          }
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
          paymentStages: true,
          assets: { where: { removedAt: null } },
          markdownSource: true,
          options: { orderBy: { position: "asc" } },
          sections: { orderBy: { position: "asc" } },
          timelinePhases: {
            include: { deliverables: true, dependencies: true }
          }
        },
        orderBy: { revision: "desc" },
        take: 1
      }
    }
  });
  const source = proposal?.revisions[0];
  if (!proposal || !source) {
    return { error: "La propuesta no tiene una revisión para duplicar." };
  }
  try {
    assertProposalCanCreateRevision(proposal.status);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se puede abrir una revisión editable todavía."
    };
  }
  if (!source.lockedAt) {
    return { error: "Ya existe una revisión editable para esta propuesta." };
  }

  await database.$transaction(async (transaction) => {
    const revision = await transaction.proposalRevision.create({
      data: {
        authorId: admin.id,
        commercialCalculationVersion: source.commercialCalculationVersion,
        currency: source.currency,
        deliveryTerms: source.deliveryTerms,
        introduction: source.introduction,
        investment: source.investment,
        paymentTermsSummary: source.paymentTermsSummary,
        proposalId,
        revision: source.revision + 1,
        taxIncluded: source.taxIncluded,
        taxDisplayMode: source.taxDisplayMode,
        terms: source.terms,
        title: source.title,
        validUntil: source.validUntil,
        warrantySummary: source.warrantySummary,
        supportSummary: source.supportSummary
      }
    });
    if (source.sections.length) {
      await transaction.proposalSection.createMany({
        data: source.sections.map((section) => ({
          content: section.content,
          contentAst: section.contentAst ?? undefined,
          internalOnly: section.internalOnly,
          isIncluded: section.isIncluded,
          metadata: section.metadata ?? undefined,
          position: section.position,
          removedAt: section.removedAt,
          revisionId: revision.id,
          slug: section.slug,
          sourceEndLine: section.sourceEndLine,
          sourceId: section.sourceId,
          sourceStartLine: section.sourceStartLine,
          title: section.title,
          type: section.type
        }))
      });
    }
    const optionIds = new Map<string, string>();
    for (const option of source.options) {
      const nextOption = await transaction.proposalOption.create({
        data: {
          archivedAt: option.archivedAt,
          code: option.code,
          conditionsSummary: option.conditionsSummary,
          description: option.description,
          estimatedDuration: option.estimatedDuration,
          investment: option.investment,
          isActive: option.isActive,
          isEnabled: option.isEnabled,
          position: option.position,
          recommended: option.recommended,
          revisionId: revision.id,
          supportSummary: option.supportSummary,
          taxIncluded: option.taxIncluded,
          title: option.title
        }
      });
      optionIds.set(option.id, nextOption.id);
    }
    if (source.lineItems.length) {
      await transaction.proposalLineItem.createMany({
        data: source.lineItems.map((lineItem) => ({
          billingType: lineItem.billingType,
          code: lineItem.code,
          contingencyPercent: lineItem.contingencyPercent,
          description: lineItem.description,
          discount: lineItem.discount,
          discountType: lineItem.discountType,
          discountValue: lineItem.discountValue,
          internalCost: lineItem.internalCost,
          internalNotes: lineItem.internalNotes,
          isActive: lineItem.isActive,
          isIncluded: lineItem.isIncluded,
          isOptional: lineItem.isOptional,
          isTaxable: lineItem.isTaxable,
          markupPercent: lineItem.markupPercent,
          name: lineItem.name,
          optionId: lineItem.optionId ? (optionIds.get(lineItem.optionId) ?? null) : null,
          position: lineItem.position,
          pricingMode: lineItem.pricingMode,
          quantity: lineItem.quantity,
          removedAt: lineItem.removedAt,
          revisionId: revision.id,
          scope: lineItem.scope,
          selectedByDefault: lineItem.selectedByDefault,
          supplier: lineItem.supplier,
          supplierReference: lineItem.supplierReference,
          taxIncluded: lineItem.taxIncluded,
          taxRate: lineItem.taxRate,
          type: lineItem.type,
          unit: lineItem.unit,
          unitPrice: lineItem.unitPrice,
          visibleForClient: lineItem.visibleForClient,
          visibleToClient: lineItem.visibleToClient
        }))
      });
    }
    const phaseIds = new Map<string, string>();
    for (const phase of source.timelinePhases) {
      const copied = await transaction.proposalTimelinePhase.create({
        data: {
          code: phase.code,
          description: phase.description,
          durationUnit: phase.durationUnit,
          durationValue: phase.durationValue,
          estimatedEndDate: phase.estimatedEndDate,
          estimatedStartDate: phase.estimatedStartDate,
          isOptional: phase.isOptional,
          optionId: phase.optionId ? (optionIds.get(phase.optionId) ?? null) : null,
          position: phase.position,
          revisionId: revision.id,
          title: phase.title,
          visibleToClient: phase.visibleToClient
        }
      });
      phaseIds.set(phase.id, copied.id);
      if (phase.deliverables.length) {
        await transaction.proposalTimelineDeliverable.createMany({
          data: phase.deliverables.map((deliverable) => ({
            description: deliverable.description,
            phaseId: copied.id,
            position: deliverable.position,
            title: deliverable.title,
            visibleToClient: deliverable.visibleToClient
          }))
        });
      }
    }
    const dependencies = source.timelinePhases.flatMap((phase) =>
      phase.dependencies.flatMap((dependency) => {
        const phaseId = phaseIds.get(phase.id);
        const dependsOnPhaseId = phaseIds.get(dependency.dependsOnPhaseId);
        return phaseId && dependsOnPhaseId ? [{ dependsOnPhaseId, phaseId }] : [];
      })
    );
    if (dependencies.length) {
      await transaction.proposalTimelineDependency.createMany({ data: dependencies });
    }
    if (source.paymentStages.length) {
      await transaction.proposalPaymentStage.createMany({
        data: source.paymentStages.map((stage) => ({
          calculationType: stage.calculationType,
          description: stage.description,
          dueDays: stage.dueDays,
          fixedAmount: stage.fixedAmount,
          optionId: stage.optionId ? (optionIds.get(stage.optionId) ?? null) : null,
          percentage: stage.percentage,
          position: stage.position,
          revisionId: revision.id,
          title: stage.title,
          triggerDescription: stage.triggerDescription,
          triggerType: stage.triggerType,
          visibleToClient: stage.visibleToClient
        }))
      });
    }
    if (source.assets.length) {
      await transaction.proposalAsset.createMany({
        data: source.assets.map((asset) => ({
          alias: asset.alias,
          altText: asset.altText,
          blobId: asset.blobId,
          isDecorative: asset.isDecorative,
          isRequired: asset.isRequired,
          originalFileName: asset.originalFileName,
          revisionId: revision.id,
          uploadedByAdminId: admin.id
        }))
      });
      await transaction.proposalEvent.create({
        data: {
          adminActorId: admin.id,
          metadata: { copiedFrom: source.id, count: source.assets.length },
          proposalId,
          revisionId: revision.id,
          type: "PROPOSAL_ASSET_REFERENCE_CLONED"
        }
      });
    }
    if (source.markdownSource) {
      const clonedSource = await transaction.proposalMarkdownSource.create({
        data: {
          importedByAdminId: admin.id,
          normalizedAst: source.markdownSource.normalizedAst ?? undefined,
          originalFileName: source.markdownSource.originalFileName,
          parseStatus: source.markdownSource.parseStatus,
          parseWarnings: source.markdownSource.parseWarnings ?? undefined,
          parserVersion: source.markdownSource.parserVersion,
          revisionId: revision.id,
          sourceHash: source.markdownSource.sourceHash,
          sourceMarkdown: source.markdownSource.sourceMarkdown,
          sourceRevisionId: source.id,
          version: 1
        },
        select: { id: true }
      });
      await transaction.proposalMarkdownCheckpoint.create({
        data: {
          createdByAdminId: admin.id,
          originalFileName: source.markdownSource.originalFileName,
          parseStatus: source.markdownSource.parseStatus,
          parseWarnings: source.markdownSource.parseWarnings ?? undefined,
          parserVersion: source.markdownSource.parserVersion,
          reason: "REVISION_CLONED",
          sequence: 1,
          sourceHash: source.markdownSource.sourceHash,
          sourceId: clonedSource.id,
          sourceMarkdown: source.markdownSource.sourceMarkdown
        }
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
