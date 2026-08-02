import { z } from "zod";

import {
  calculateAlternative,
  calculatePaymentSchedule,
  decimalText,
  type CommercialLineItemInput,
  type CommercialOptionInput,
  type CommercialPaymentStageInput,
  type DecimalInput
} from "./commercial-calculator";

const totalsSchema = z
  .object({
    discount: z.string(),
    subtotal: z.string(),
    tax: z.string(),
    total: z.string()
  })
  .strict();

const publicLineItemSchema = z
  .object({
    billingType: z.string(),
    code: z.string(),
    description: z.string().nullable(),
    discount: z.string(),
    id: z.string(),
    isIncluded: z.boolean(),
    isOptional: z.boolean(),
    name: z.string(),
    quantity: z.string(),
    tax: z.string(),
    total: z.string(),
    unit: z.string(),
    unitPrice: z.string()
  })
  .strict();

const publicOptionSchema = z
  .object({
    annual: totalsSchema,
    code: z.string(),
    conditionsSummary: z.string().nullable(),
    description: z.string().nullable(),
    estimatedDuration: z.string().nullable(),
    id: z.string(),
    lineItems: z.array(publicLineItemSchema),
    monthly: totalsSchema,
    oneTime: totalsSchema,
    optional: totalsSchema,
    recommended: z.boolean(),
    supportSummary: z.string().nullable(),
    title: z.string()
  })
  .strict();

export const publicProposalCommercialSchema = z
  .object({
    alternatives: z.array(publicOptionSchema),
    calculationVersion: z.string(),
    currency: z.string().length(3),
    lineItems: z.array(publicLineItemSchema),
    paymentSchedule: z.array(
      z
        .object({
          amount: z.string(),
          description: z.string().nullable(),
          dueDays: z.number().int().nullable(),
          optionCode: z.string().nullable(),
          percentage: z.string().nullable(),
          title: z.string(),
          triggerDescription: z.string().nullable(),
          triggerType: z.string()
        })
        .strict()
    ),
    terms: z
      .object({
        deliveryTerms: z.string().nullable(),
        paymentTermsSummary: z.string().nullable(),
        supportSummary: z.string().nullable(),
        validUntil: z.string().nullable(),
        warrantySummary: z.string().nullable()
      })
      .strict(),
    timeline: z.array(
      z
        .object({
          code: z.string(),
          deliverables: z.array(
            z.object({ description: z.string().nullable(), title: z.string() }).strict()
          ),
          dependencies: z.array(z.string()),
          description: z.string().nullable(),
          duration: z.string(),
          isOptional: z.boolean(),
          optionCode: z.string().nullable(),
          title: z.string()
        })
        .strict()
    )
  })
  .strict();

export type PublicProposalCommercialDTO = z.infer<typeof publicProposalCommercialSchema>;

export type CommercialRevisionForDto = {
  commercialCalculationVersion: string;
  currency: string;
  deliveryTerms: string | null;
  lineItems: Array<
    CommercialLineItemInput & {
      description: string | null;
      name: string;
      unit: string;
    }
  >;
  options: Array<
    CommercialOptionInput & {
      code: string;
      conditionsSummary: string | null;
      description: string | null;
      estimatedDuration: string | null;
      recommended: boolean;
      supportSummary: string | null;
      title: string;
    }
  >;
  paymentStages: Array<
    CommercialPaymentStageInput & {
      description: string | null;
      dueDays: number | null;
      option: { code: string } | null;
      percentage?: DecimalInput;
      title: string;
      triggerDescription: string | null;
      triggerType: string;
    }
  >;
  paymentTermsSummary: string | null;
  supportSummary: string | null;
  timelinePhases: Array<{
    code: string;
    deliverables: Array<{
      description: string | null;
      title: string;
      visibleToClient: boolean;
    }>;
    dependencies: Array<{ dependsOnPhase: { code: string } }>;
    description: string | null;
    durationUnit: string;
    durationValue: number;
    isOptional: boolean;
    option: { code: string } | null;
    title: string;
    visibleToClient: boolean;
  }>;
  validUntil: Date | null;
  warrantySummary: string | null;
};

type CommercialLineForDto = CommercialLineItemInput & {
  description: string | null;
  name: string;
  unit: string;
};

function totalsToDto(totals: {
  discount: DecimalInput;
  subtotal: DecimalInput;
  tax: DecimalInput;
  total: DecimalInput;
}) {
  return {
    discount: decimalText(totals.discount),
    subtotal: decimalText(totals.subtotal),
    tax: decimalText(totals.tax),
    total: decimalText(totals.total)
  };
}

/**
 * Public is an allowlist by construction. The internal cost, supplier,
 * markup, contingency and pricing analytics fields do not appear in this
 * object at all, rather than being hidden later in a component.
 */
export function buildPublicProposalCommercialDto(
  revision: CommercialRevisionForDto
): PublicProposalCommercialDTO {
  const visibleLines = revision.lineItems.filter(
    (lineItem) => lineItem.visibleToClient && lineItem.isActive
  );
  const toPublicLine = (
    lineItem: CommercialLineForDto,
    result: ReturnType<typeof calculateAlternative>["lines"][number]["result"]
  ) => ({
    billingType: lineItem.billingType,
    code: lineItem.code,
    description: lineItem.description,
    discount: decimalText(result.discount),
    id: lineItem.id,
    isIncluded: lineItem.isIncluded || lineItem.billingType === "INCLUDED",
    isOptional: lineItem.isOptional || lineItem.billingType === "OPTIONAL",
    name: lineItem.name,
    quantity: decimalText(lineItem.quantity, 4),
    tax: decimalText(result.tax),
    total: decimalText(result.total),
    unit: lineItem.unit,
    unitPrice: decimalText(lineItem.unitPrice)
  });
  const alternatives = revision.options
    .filter((option) => option.isActive)
    .map((option) => {
      const calculated = calculateAlternative({
        includeOptional: true,
        lineItems: visibleLines,
        option
      });
      return {
        annual: totalsToDto(calculated.annual),
        code: option.code,
        conditionsSummary: option.conditionsSummary,
        description: option.description,
        estimatedDuration: option.estimatedDuration,
        id: option.id,
        lineItems: calculated.lines.map(({ input, result }) =>
          toPublicLine(input as CommercialLineForDto, result)
        ),
        monthly: totalsToDto(calculated.monthly),
        oneTime: totalsToDto(calculated.oneTime),
        optional: totalsToDto(calculated.optional),
        recommended: option.recommended,
        supportSummary: option.supportSummary,
        title: option.title
      };
    });

  const defaultAlternative =
    alternatives.find((option) => option.recommended) ?? alternatives[0];
  const defaultInput =
    revision.options.find((option) => option.id === defaultAlternative?.id) ?? null;
  const defaultCalculation = calculateAlternative({
    includeOptional: true,
    lineItems: visibleLines,
    option: defaultInput
  });
  const paymentSchedule = calculatePaymentSchedule({
    stages: revision.paymentStages
      .filter(
        (stage) =>
          stage.visibleToClient &&
          (stage.optionId === null || stage.optionId === defaultInput?.id)
      )
      .map((stage, index) => ({ ...stage, position: stage.position ?? index + 1 })),
    total: defaultCalculation.oneTime.total
  }).map((calculated) => {
    const stage = revision.paymentStages.find(
      (candidate) => candidate.id === calculated.id
    )!;
    return {
      amount: decimalText(calculated.amount),
      description: stage.description,
      dueDays: stage.dueDays,
      optionCode: stage.option?.code ?? null,
      percentage:
        stage.calculationType === "PERCENTAGE" ? decimalText(stage.percentage, 4) : null,
      title: stage.title,
      triggerDescription: stage.triggerDescription,
      triggerType: stage.triggerType
    };
  });

  return publicProposalCommercialSchema.parse({
    alternatives,
    calculationVersion: revision.commercialCalculationVersion,
    currency: revision.currency,
    lineItems: defaultCalculation.lines.map(({ input, result }) =>
      toPublicLine(input as CommercialLineForDto, result)
    ),
    paymentSchedule,
    terms: {
      deliveryTerms: revision.deliveryTerms,
      paymentTermsSummary: revision.paymentTermsSummary,
      supportSummary: revision.supportSummary,
      validUntil: revision.validUntil?.toISOString().slice(0, 10) ?? null,
      warrantySummary: revision.warrantySummary
    },
    timeline: revision.timelinePhases
      .filter((phase) => phase.visibleToClient)
      .map((phase) => ({
        code: phase.code,
        deliverables: phase.deliverables
          .filter((deliverable) => deliverable.visibleToClient)
          .map((deliverable) => ({
            description: deliverable.description,
            title: deliverable.title
          })),
        dependencies: phase.dependencies.map(
          (dependency) => dependency.dependsOnPhase.code
        ),
        description: phase.description,
        duration: `${phase.durationValue} ${phase.durationUnit}`,
        isOptional: phase.isOptional,
        optionCode: phase.option?.code ?? null,
        title: phase.title
      }))
  });
}

export function assertPublicCommercialPrivacy(dto: PublicProposalCommercialDTO) {
  const serialized = JSON.stringify(dto);
  for (const forbidden of [
    "internalCost",
    "markupPercent",
    "contingencyPercent",
    "supplier",
    "supplierReference",
    "internalNotes",
    "grossProfit",
    "grossMarginPercent",
    "pricingMode",
    "suggestedUnitPrice"
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`El DTO público filtró el campo interno ${forbidden}.`);
    }
  }
}
