"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  CommercialValidationError,
  commercialRevisionInputSchema,
  validateCommercialRevision,
  type CommercialRevisionInput
} from "@/lib/proposals/commercial-validation";
import { commercialCalculationVersion } from "@/lib/proposals/commercial-calculator";
import { proposalStatus } from "@/lib/proposals/proposal-state";

export type CommercialProposalActionState = {
  commercialVersion?: number;
  conflict?: {
    currentCommercialVersion: number;
    message: string;
  };
  error?: string;
  fieldErrors?: string[];
  success?: string;
};

class CommercialConflictError extends Error {
  readonly currentCommercialVersion: number;

  constructor(currentCommercialVersion: number) {
    super("Otra pestaña actualizó los datos comerciales. Recarga antes de continuar.");
    this.currentCommercialVersion = currentCommercialVersion;
    this.name = "CommercialConflictError";
  }
}

function invalidateProposalPaths(proposalId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  revalidatePath(`/admin/propuestas/${proposalId}`);
}

function dateOrNull(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function parseCommercialPayload(formData: FormData) {
  const raw = formData.get("commercialPayload");
  if (typeof raw !== "string" || raw.length > 1_000_000) {
    return null;
  }
  try {
    return commercialRevisionInputSchema.safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function assertKnownIds(
  input: CommercialRevisionInput,
  current: {
    lineItems: Array<{ id: string }>;
    options: Array<{ id: string }>;
    paymentStages: Array<{ id: string }>;
    timelinePhases: Array<{ id: string }>;
  }
) {
  const allowed = {
    lineItems: new Set(current.lineItems.map((item) => item.id)),
    options: new Set(current.options.map((item) => item.id)),
    paymentStages: new Set(current.paymentStages.map((item) => item.id)),
    timelinePhases: new Set(current.timelinePhases.map((item) => item.id))
  };
  const invalid = [
    ...input.options.filter((item) => item.id && !allowed.options.has(item.id)),
    ...input.lineItems.filter((item) => item.id && !allowed.lineItems.has(item.id)),
    ...input.timelinePhases.filter(
      (item) => item.id && !allowed.timelinePhases.has(item.id)
    ),
    ...input.paymentStages.filter(
      (item) => item.id && !allowed.paymentStages.has(item.id)
    )
  ];
  if (invalid.length) {
    throw new Error("El formulario contiene un ID que no pertenece a esta revisión.");
  }
}

function changedFields(before: unknown, after: object) {
  if (!before) {
    return Object.keys(after).filter((key) => key !== "id");
  }
  const previous = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  return Object.keys(next).filter((key) => {
    return JSON.stringify(previous[key]) !== JSON.stringify(next[key]);
  });
}

/**
 * Replaces only the submitted entity set inside one transaction. The revision
 * version is claimed first, so stale tabs cannot silently win. Costs and notes
 * are deliberately excluded from event metadata.
 */
export async function saveCommercialProposalData(
  revisionId: string,
  _previousState: CommercialProposalActionState,
  formData: FormData
): Promise<CommercialProposalActionState> {
  void _previousState;
  const parsedPayload = parseCommercialPayload(formData);
  if (!parsedPayload?.success) {
    return { error: "El paquete comercial no tiene un formato válido." };
  }
  const input = parsedPayload.data;
  try {
    validateCommercialRevision(input);
  } catch (error) {
    if (error instanceof CommercialValidationError) {
      return { error: error.message, fieldErrors: error.issues };
    }
    return { error: "No se pudo validar el cálculo comercial." };
  }

  const admin = await requireCurrentAdmin();
  const revision = await database.proposalRevision.findUnique({
    where: { id: revisionId },
    include: {
      proposal: { select: { status: true } },
      lineItems: { select: { id: true } },
      options: { select: { id: true } },
      paymentStages: { select: { id: true } },
      timelinePhases: { select: { id: true } }
    }
  });
  if (
    !revision ||
    revision.lockedAt ||
    revision.proposal.status !== proposalStatus.DRAFT
  ) {
    return { error: "Esta revisión ya no es un borrador comercial editable." };
  }
  if (revision.commercialVersion !== input.expectedCommercialVersion) {
    return {
      conflict: {
        currentCommercialVersion: revision.commercialVersion,
        message: "Otra pestaña guardó una versión más reciente. Recarga para comparar."
      }
    };
  }
  try {
    assertKnownIds(input, revision);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ID comercial inválido." };
  }

  try {
    await database.$transaction(async (transaction) => {
      const claimed = await transaction.proposalRevision.updateMany({
        where: {
          commercialVersion: input.expectedCommercialVersion,
          id: revisionId,
          lockedAt: null
        },
        data: { commercialVersion: { increment: 1 } }
      });
      if (!claimed.count) {
        const current = await transaction.proposalRevision.findUnique({
          where: { id: revisionId },
          select: { commercialVersion: true }
        });
        throw new CommercialConflictError(current?.commercialVersion ?? 0);
      }

      const current = await transaction.proposalRevision.findUnique({
        where: { id: revisionId },
        include: {
          proposal: { select: { id: true, status: true } },
          lineItems: true,
          options: true,
          paymentStages: true,
          timelinePhases: true
        }
      });
      if (
        !current ||
        current.lockedAt ||
        current.proposal.status !== proposalStatus.DRAFT
      ) {
        throw new Error("La revisión dejó de ser editable durante el guardado.");
      }

      await transaction.proposalRevision.update({
        where: { id: revisionId },
        data: {
          commercialCalculationVersion,
          currency: input.currency,
          deliveryTerms: input.deliveryTerms,
          paymentTermsSummary: input.paymentTermsSummary,
          supportSummary: input.supportSummary,
          taxDisplayMode: input.taxDisplayMode,
          validUntil: dateOrNull(input.validUntil),
          warrantySummary: input.warrantySummary
        }
      });

      // Recommendation must be reset before the partial unique index accepts
      // the new ordering/selection.
      await transaction.proposalOption.updateMany({
        where: { revisionId },
        data: { position: { increment: 10000 }, recommended: false }
      });
      const optionIds = new Map<string, string>();
      const existingOptions = new Map(current.options.map((item) => [item.id, item]));
      const submittedOptionIds = new Set(
        input.options.flatMap((item) => (item.id ? [item.id] : []))
      );
      for (const [index, option] of input.options.entries()) {
        const data = {
          archivedAt: option.isActive ? null : new Date(),
          code: option.code,
          conditionsSummary: option.conditionsSummary,
          description: option.description,
          estimatedDuration: option.estimatedDuration,
          isActive: option.isActive,
          isEnabled: option.isActive,
          position: index + 1,
          recommended: option.isActive && option.recommended,
          supportSummary: option.supportSummary,
          title: option.title
        };
        const existing = option.id ? existingOptions.get(option.id) : undefined;
        const saved = existing
          ? await transaction.proposalOption.update({ where: { id: existing.id }, data })
          : await transaction.proposalOption.create({
              data: {
                revisionId,
                taxIncluded: input.taxDisplayMode === "INCLUSIVE",
                ...data
              }
            });
        optionIds.set(option.code, saved.id);
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: {
              entityId: saved.id,
              fields: changedFields(existing, { ...data, code: option.code })
            },
            proposalId: current.proposal.id,
            revisionId,
            type: existing ? "PROPOSAL_OPTION_UPDATED" : "PROPOSAL_OPTION_CREATED"
          }
        });
      }
      for (const option of current.options) {
        if (submittedOptionIds.has(option.id)) {
          continue;
        }
        await transaction.proposalOption.update({
          where: { id: option.id },
          data: {
            archivedAt: new Date(),
            isActive: false,
            isEnabled: false,
            recommended: false
          }
        });
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: { entityId: option.id },
            proposalId: current.proposal.id,
            revisionId,
            type: "PROPOSAL_OPTION_ARCHIVED"
          }
        });
      }

      const existingLines = new Map(current.lineItems.map((item) => [item.id, item]));
      await transaction.proposalLineItem.updateMany({
        where: { revisionId },
        data: { position: { increment: 10000 } }
      });
      const submittedLineIds = new Set(
        input.lineItems.flatMap((item) => (item.id ? [item.id] : []))
      );
      for (const [index, lineItem] of input.lineItems.entries()) {
        const optionId =
          lineItem.scope === "COMMON"
            ? null
            : (optionIds.get(lineItem.optionCode ?? "") ?? null);
        const data = {
          billingType: lineItem.billingType,
          code: lineItem.code,
          contingencyPercent: lineItem.contingencyPercent,
          description: lineItem.description ?? "",
          discount:
            lineItem.discountType === "FIXED_AMOUNT" ? lineItem.discountValue : "0",
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
          optionId,
          position: index + 1,
          pricingMode: lineItem.pricingMode,
          quantity: lineItem.quantity,
          removedAt: lineItem.isActive ? null : new Date(),
          scope: lineItem.scope,
          selectedByDefault: lineItem.selectedByDefault,
          supplier: lineItem.supplier,
          supplierReference: lineItem.supplierReference,
          taxIncluded: lineItem.taxIncluded,
          taxRate: lineItem.taxRate,
          type: lineItem.billingType,
          unit: lineItem.unit,
          unitPrice: lineItem.unitPrice,
          visibleForClient: lineItem.visibleToClient,
          visibleToClient: lineItem.visibleToClient
        };
        const existing = lineItem.id ? existingLines.get(lineItem.id) : undefined;
        const saved = existing
          ? await transaction.proposalLineItem.update({
              where: { id: existing.id },
              data
            })
          : await transaction.proposalLineItem.create({ data: { revisionId, ...data } });
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: {
              entityId: saved.id,
              fields: changedFields(existing, {
                billingType: lineItem.billingType,
                code: lineItem.code,
                name: lineItem.name,
                optionId,
                visibleToClient: lineItem.visibleToClient
              })
            },
            proposalId: current.proposal.id,
            revisionId,
            type: existing ? "PROPOSAL_LINE_ITEM_UPDATED" : "PROPOSAL_LINE_ITEM_CREATED"
          }
        });
      }
      for (const lineItem of current.lineItems) {
        if (submittedLineIds.has(lineItem.id)) {
          continue;
        }
        await transaction.proposalLineItem.update({
          where: { id: lineItem.id },
          data: { isActive: false, removedAt: new Date() }
        });
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: { entityId: lineItem.id },
            proposalId: current.proposal.id,
            revisionId,
            type: "PROPOSAL_LINE_ITEM_ARCHIVED"
          }
        });
      }

      const existingPhases = new Map(
        current.timelinePhases.map((item) => [item.id, item])
      );
      await transaction.proposalTimelinePhase.updateMany({
        where: { revisionId },
        data: { position: { increment: 10000 } }
      });
      const phaseIds = new Map<string, string>();
      const submittedPhaseIds = new Set(
        input.timelinePhases.flatMap((item) => (item.id ? [item.id] : []))
      );
      for (const [index, phase] of input.timelinePhases.entries()) {
        const data = {
          code: phase.code,
          description: phase.description,
          durationUnit: phase.durationUnit,
          durationValue: phase.durationValue,
          estimatedEndDate: dateOrNull(phase.estimatedEndDate),
          estimatedStartDate: dateOrNull(phase.estimatedStartDate),
          isOptional: phase.isOptional,
          optionId: phase.optionCode ? (optionIds.get(phase.optionCode) ?? null) : null,
          position: index + 1,
          title: phase.title,
          visibleToClient: phase.visibleToClient
        };
        const existing = phase.id ? existingPhases.get(phase.id) : undefined;
        const saved = existing
          ? await transaction.proposalTimelinePhase.update({
              where: { id: existing.id },
              data
            })
          : await transaction.proposalTimelinePhase.create({
              data: { revisionId, ...data }
            });
        phaseIds.set(phase.code, saved.id);
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: {
              entityId: saved.id,
              fields: changedFields(existing, { ...data, code: phase.code })
            },
            proposalId: current.proposal.id,
            revisionId,
            type: existing
              ? "PROPOSAL_TIMELINE_PHASE_UPDATED"
              : "PROPOSAL_TIMELINE_PHASE_CREATED"
          }
        });
      }
      const phasesToRemove = current.timelinePhases.filter(
        (phase) => !submittedPhaseIds.has(phase.id)
      );
      if (phasesToRemove.length) {
        await transaction.proposalTimelinePhase.deleteMany({
          where: { id: { in: phasesToRemove.map((phase) => phase.id) } }
        });
        await transaction.proposalEvent.createMany({
          data: phasesToRemove.map((phase) => ({
            adminActorId: admin.id,
            metadata: { entityId: phase.id },
            proposalId: current.proposal.id,
            revisionId,
            type: "PROPOSAL_TIMELINE_PHASE_REMOVED" as const
          }))
        });
      }
      const allPhaseIds = [...phaseIds.values()];
      if (allPhaseIds.length) {
        await transaction.proposalTimelineDependency.deleteMany({
          where: { phaseId: { in: allPhaseIds } }
        });
        await transaction.proposalTimelineDeliverable.deleteMany({
          where: { phaseId: { in: allPhaseIds } }
        });
      }
      const dependencies = input.timelinePhases.flatMap((phase) =>
        phase.dependsOnCodes.map((dependsOnCode) => ({
          dependsOnPhaseId: phaseIds.get(dependsOnCode)!,
          phaseId: phaseIds.get(phase.code)!
        }))
      );
      if (dependencies.length) {
        await transaction.proposalTimelineDependency.createMany({ data: dependencies });
      }
      const deliverables = input.timelinePhases.flatMap((phase) =>
        phase.deliverables.map((deliverable, index) => ({
          description: deliverable.description,
          phaseId: phaseIds.get(phase.code)!,
          position: index + 1,
          title: deliverable.title,
          visibleToClient: deliverable.visibleToClient
        }))
      );
      if (deliverables.length) {
        await transaction.proposalTimelineDeliverable.createMany({ data: deliverables });
      }

      const existingStages = new Map(
        current.paymentStages.map((item) => [item.id, item])
      );
      await transaction.proposalPaymentStage.updateMany({
        where: { revisionId },
        data: { position: { increment: 10000 } }
      });
      const submittedStageIds = new Set(
        input.paymentStages.flatMap((item) => (item.id ? [item.id] : []))
      );
      for (const [index, stage] of input.paymentStages.entries()) {
        const data = {
          calculationType: stage.calculationType,
          description: stage.description,
          dueDays: stage.dueDays,
          fixedAmount: stage.fixedAmount,
          optionId: stage.optionCode ? (optionIds.get(stage.optionCode) ?? null) : null,
          percentage: stage.percentage,
          position: index + 1,
          title: stage.title,
          triggerDescription: stage.triggerDescription,
          triggerType: stage.triggerType,
          visibleToClient: stage.visibleToClient
        };
        const existing = stage.id ? existingStages.get(stage.id) : undefined;
        const saved = existing
          ? await transaction.proposalPaymentStage.update({
              where: { id: existing.id },
              data
            })
          : await transaction.proposalPaymentStage.create({
              data: { revisionId, ...data }
            });
        await transaction.proposalEvent.create({
          data: {
            adminActorId: admin.id,
            metadata: {
              entityId: saved.id,
              fields: changedFields(existing, { ...data })
            },
            proposalId: current.proposal.id,
            revisionId,
            type: existing
              ? "PROPOSAL_PAYMENT_STAGE_UPDATED"
              : "PROPOSAL_PAYMENT_STAGE_CREATED"
          }
        });
      }
      const stagesToRemove = current.paymentStages.filter(
        (stage) => !submittedStageIds.has(stage.id)
      );
      if (stagesToRemove.length) {
        await transaction.proposalPaymentStage.deleteMany({
          where: { id: { in: stagesToRemove.map((stage) => stage.id) } }
        });
        await transaction.proposalEvent.createMany({
          data: stagesToRemove.map((stage) => ({
            adminActorId: admin.id,
            metadata: { entityId: stage.id },
            proposalId: current.proposal.id,
            revisionId,
            type: "PROPOSAL_PAYMENT_STAGE_REMOVED" as const
          }))
        });
      }
      await transaction.proposalEvent.create({
        data: {
          adminActorId: admin.id,
          metadata: { calculationVersion: commercialCalculationVersion },
          proposalId: current.proposal.id,
          revisionId,
          type: "PROPOSAL_COMMERCIAL_RECALCULATED"
        }
      });
    });
  } catch (error) {
    if (error instanceof CommercialConflictError) {
      await database.proposalEvent.create({
        data: {
          adminActorId: admin.id,
          metadata: { expectedCommercialVersion: input.expectedCommercialVersion },
          proposalId: revision.proposalId,
          revisionId,
          type: "PROPOSAL_COMMERCIAL_CONFLICT"
        }
      });
      return {
        conflict: {
          currentCommercialVersion: error.currentCommercialVersion,
          message: error.message
        }
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el borrador comercial."
    };
  }

  invalidateProposalPaths(revision.proposalId);
  return {
    commercialVersion: input.expectedCommercialVersion + 1,
    success: "Datos comerciales guardados y recalculados en el servidor."
  };
}
