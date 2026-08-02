import { z } from "zod";

import {
  calculateAlternative,
  calculatePaymentSchedule,
  commercialCalculationVersion,
  money,
  percentage,
  quantity,
  type CommercialLineItemInput,
  type CommercialPaymentStageInput
} from "./commercial-calculator";

export const proposalUnitCatalog = [
  "service",
  "hour",
  "day",
  "week",
  "month",
  "license",
  "user",
  "device",
  "location",
  "site",
  "unit",
  "package",
  "project",
  "phase"
] as const;

const decimalPattern = /^\d{1,14}(?:\.\d{1,4})?$/u;
const monetaryPattern = /^\d{1,16}(?:\.\d{1,2})?$/u;
const percentagePattern = /^\d{1,5}(?:\.\d{1,4})?$/u;
const unitPattern = /^[a-z][a-z0-9 _-]{1,39}$/u;

const decimalText = z.string().trim().regex(decimalPattern);
const moneyText = z.string().trim().regex(monetaryPattern);
const percentageText = z.string().trim().regex(percentagePattern);
const nullableText = (limit: number) => z.string().trim().max(limit).nullable();

export const commercialOptionInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_-]{1,23}$/u),
    conditionsSummary: nullableText(1000),
    description: nullableText(2000),
    estimatedDuration: nullableText(160),
    id: z.string().cuid().optional(),
    isActive: z.boolean(),
    recommended: z.boolean(),
    supportSummary: nullableText(1000),
    title: z.string().trim().min(2).max(140)
  })
  .strict();

export const commercialLineItemInputSchema = z
  .object({
    billingType: z.enum([
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
    ]),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_-]{1,39}$/u),
    contingencyPercent: percentageText.nullable(),
    description: nullableText(1000),
    discountType: z.enum(["NONE", "PERCENTAGE", "FIXED_AMOUNT"]),
    discountValue: moneyText,
    id: z.string().cuid().optional(),
    internalCost: moneyText.nullable(),
    internalNotes: nullableText(2000),
    isActive: z.boolean(),
    isIncluded: z.boolean(),
    isOptional: z.boolean(),
    isTaxable: z.boolean(),
    markupPercent: percentageText.nullable(),
    name: z.string().trim().min(2).max(255),
    optionCode: z.string().trim().toUpperCase().max(24).nullable(),
    pricingMode: z.enum(["MARKUP", "MANUAL"]),
    quantity: decimalText,
    scope: z.enum(["COMMON", "OPTION_SPECIFIC"]),
    selectedByDefault: z.boolean(),
    supplier: nullableText(255),
    supplierReference: nullableText(255),
    taxIncluded: z.boolean(),
    taxRate: percentageText,
    unit: z.string().trim().toLowerCase().regex(unitPattern),
    unitPrice: moneyText,
    visibleToClient: z.boolean()
  })
  .strict();

const deliverableInputSchema = z
  .object({
    description: nullableText(4000),
    title: z.string().trim().min(2).max(255),
    visibleToClient: z.boolean()
  })
  .strict();

export const commercialTimelinePhaseInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_-]{1,79}$/u),
    dependsOnCodes: z.array(z.string().trim().toUpperCase()).max(24),
    deliverables: z.array(deliverableInputSchema).max(50),
    description: nullableText(4000),
    durationUnit: z.enum(["DAY", "WEEK", "MONTH"]),
    durationValue: z.int().min(1).max(10000),
    estimatedEndDate: z.string().date().nullable(),
    estimatedStartDate: z.string().date().nullable(),
    id: z.string().cuid().optional(),
    isOptional: z.boolean(),
    optionCode: z.string().trim().toUpperCase().max(24).nullable(),
    title: z.string().trim().min(2).max(255),
    visibleToClient: z.boolean()
  })
  .strict();

export const commercialPaymentStageInputSchema = z
  .object({
    calculationType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "REMAINDER"]),
    description: nullableText(2000),
    dueDays: z.int().min(0).max(3650).nullable(),
    fixedAmount: moneyText.nullable(),
    id: z.string().cuid().optional(),
    optionCode: z.string().trim().toUpperCase().max(24).nullable(),
    percentage: percentageText.nullable(),
    title: z.string().trim().min(2).max(255),
    triggerDescription: nullableText(1000),
    triggerType: z.enum([
      "ACCEPTANCE",
      "PROJECT_START",
      "MILESTONE",
      "DELIVERY",
      "CALENDAR_DATE",
      "MANUAL"
    ]),
    visibleToClient: z.boolean()
  })
  .strict();

export const commercialRevisionInputSchema = z
  .object({
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/u),
    deliveryTerms: nullableText(2000),
    expectedCommercialVersion: z.int().positive(),
    lineItems: z.array(commercialLineItemInputSchema).max(500),
    options: z.array(commercialOptionInputSchema).max(12),
    paymentStages: z.array(commercialPaymentStageInputSchema).max(20),
    paymentTermsSummary: nullableText(1000),
    supportSummary: nullableText(2000),
    taxDisplayMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    timelinePhases: z.array(commercialTimelinePhaseInputSchema).max(100),
    validUntil: z.string().date().nullable(),
    warrantySummary: nullableText(2000)
  })
  .strict();

export type CommercialRevisionInput = z.infer<typeof commercialRevisionInputSchema>;

export class CommercialValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues[0] ?? "Los datos comerciales no son válidos.");
    this.issues = issues;
    this.name = "CommercialValidationError";
  }
}

function isPositive(text: string) {
  return quantity(text).greaterThan(0);
}

function cycleInTimeline(phases: CommercialRevisionInput["timelinePhases"]) {
  const phaseCodes = new Set(phases.map((phase) => phase.code));
  const graph = new Map(phases.map((phase) => [phase.code, phase.dependsOnCodes]));
  const active = new Set<string>();
  const complete = new Set<string>();

  const walk = (code: string): boolean => {
    if (active.has(code)) {
      return true;
    }
    if (complete.has(code)) {
      return false;
    }
    active.add(code);
    for (const dependency of graph.get(code) ?? []) {
      if (!phaseCodes.has(dependency) || walk(dependency)) {
        return true;
      }
    }
    active.delete(code);
    complete.add(code);
    return false;
  };

  return phases.some((phase) => walk(phase.code));
}

/** Validates business invariants before the transaction writes a single row. */
export function validateCommercialRevision(input: CommercialRevisionInput) {
  const issues: string[] = [];
  const optionCodes = new Set<string>();
  const activeOptionCodes = new Set(
    input.options.filter((option) => option.isActive).map((option) => option.code)
  );
  const activeRecommended = input.options.filter(
    (option) => option.isActive && option.recommended
  );
  for (const option of input.options) {
    if (optionCodes.has(option.code)) {
      issues.push(`La alternativa ${option.code} está duplicada.`);
    }
    optionCodes.add(option.code);
  }
  if (activeRecommended.length > 1) {
    issues.push("Sólo una alternativa activa puede estar marcada como recomendada.");
  }

  const lineCodes = new Set<string>();
  for (const lineItem of input.lineItems) {
    if (lineCodes.has(lineItem.code)) {
      issues.push(`El concepto ${lineItem.code} está duplicado.`);
    }
    lineCodes.add(lineItem.code);
    if (!isPositive(lineItem.quantity)) {
      issues.push(`El concepto ${lineItem.code} necesita una cantidad positiva.`);
    }
    if (lineItem.scope === "COMMON" && lineItem.optionCode) {
      issues.push(
        `El concepto común ${lineItem.code} no puede pertenecer a una alternativa.`
      );
    }
    if (lineItem.scope === "OPTION_SPECIFIC" && !lineItem.optionCode) {
      issues.push(`El concepto ${lineItem.code} debe pertenecer a una alternativa.`);
    }
    if (lineItem.optionCode && !optionCodes.has(lineItem.optionCode)) {
      issues.push(`El concepto ${lineItem.code} referencia una alternativa inexistente.`);
    }
    if (lineItem.optionCode && !activeOptionCodes.has(lineItem.optionCode)) {
      issues.push(
        `El concepto ${lineItem.code} no puede seleccionar una alternativa inactiva.`
      );
    }
    if (percentage(lineItem.taxRate).greaterThan(100)) {
      issues.push(`El impuesto de ${lineItem.code} no puede superar 100%.`);
    }
    if (
      lineItem.discountType === "PERCENTAGE" &&
      percentage(lineItem.discountValue).greaterThan(100)
    ) {
      issues.push(`El descuento porcentual de ${lineItem.code} no puede superar 100%.`);
    }
    const calculated = calculateAlternative({
      lineItems: [
        {
          ...lineItem,
          id: lineItem.id ?? lineItem.code,
          optionId: null,
          visibleToClient: true
        } satisfies CommercialLineItemInput
      ],
      option: null
    }).lines[0]?.result;
    if (
      lineItem.discountType === "FIXED_AMOUNT" &&
      calculated &&
      money(lineItem.discountValue).greaterThan(calculated.baseAmount)
    ) {
      issues.push(`El descuento fijo de ${lineItem.code} excede su importe base.`);
    }
    if (lineItem.pricingMode === "MARKUP" && lineItem.internalCost === null) {
      issues.push(`El concepto ${lineItem.code} usa markup y requiere costo interno.`);
    }
  }

  const timelineCodes = new Set<string>();
  for (const phase of input.timelinePhases) {
    if (timelineCodes.has(phase.code)) {
      issues.push(`La fase ${phase.code} está duplicada.`);
    }
    timelineCodes.add(phase.code);
    if (phase.optionCode && !optionCodes.has(phase.optionCode)) {
      issues.push(`La fase ${phase.code} referencia una alternativa inexistente.`);
    }
    if (phase.optionCode && !activeOptionCodes.has(phase.optionCode)) {
      issues.push(`La fase ${phase.code} no puede seleccionar una alternativa inactiva.`);
    }
  }
  if (cycleInTimeline(input.timelinePhases)) {
    issues.push("El cronograma contiene una dependencia inexistente o un ciclo.");
  }

  const remainders = input.paymentStages.filter(
    (stage) => stage.calculationType === "REMAINDER"
  );
  if (remainders.length > 1) {
    issues.push("El esquema de pagos sólo puede tener un REMAINDER.");
  }
  const paymentPercent = input.paymentStages
    .filter((stage) => stage.calculationType === "PERCENTAGE")
    .reduce((total, stage) => total.plus(percentage(stage.percentage)), money("0"));
  if (paymentPercent.greaterThan(100)) {
    issues.push("Los porcentajes del esquema de pagos no pueden superar 100%.");
  }
  for (const stage of input.paymentStages) {
    if (stage.calculationType === "PERCENTAGE" && stage.percentage === null) {
      issues.push(`La etapa ${stage.title} requiere un porcentaje.`);
    }
    if (stage.calculationType === "FIXED_AMOUNT" && stage.fixedAmount === null) {
      issues.push(`La etapa ${stage.title} requiere un importe fijo.`);
    }
    if (stage.optionCode && !optionCodes.has(stage.optionCode)) {
      issues.push(`La etapa ${stage.title} referencia una alternativa inexistente.`);
    }
    if (stage.optionCode && !activeOptionCodes.has(stage.optionCode)) {
      issues.push(
        `La etapa ${stage.title} no puede seleccionar una alternativa inactiva.`
      );
    }
  }

  for (const option of input.options.filter((candidate) => candidate.isActive)) {
    const total = calculateAlternative({
      lineItems: input.lineItems.map((lineItem) => ({
        ...lineItem,
        id: lineItem.id ?? lineItem.code,
        optionId: lineItem.optionCode === option.code ? option.code : null
      })),
      option: { id: option.code, isActive: option.isActive }
    }).oneTime.total;
    const optionStages = input.paymentStages
      .filter((stage) => stage.optionCode === null || stage.optionCode === option.code)
      .map(
        (stage, position) =>
          ({
            ...stage,
            id: stage.id ?? `stage-${position}`,
            optionId: stage.optionCode,
            position: position + 1
          }) satisfies CommercialPaymentStageInput
      );
    const scheduled = calculatePaymentSchedule({ stages: optionStages, total }).reduce(
      (sum, stage) => sum.plus(stage.amount),
      money("0")
    );
    if (scheduled.greaterThan(total)) {
      issues.push(`El esquema de pagos supera el total de ${option.code}.`);
    }
    const visibleSpecific = input.lineItems.some(
      (lineItem) =>
        lineItem.isActive &&
        lineItem.visibleToClient &&
        lineItem.scope === "OPTION_SPECIFIC" &&
        lineItem.optionCode === option.code
    );
    if (!visibleSpecific) {
      issues.push(
        `La alternativa activa ${option.code} necesita al menos un concepto visible.`
      );
    }
  }

  if (issues.length) {
    throw new CommercialValidationError(issues);
  }
  return { calculationVersion: commercialCalculationVersion };
}
