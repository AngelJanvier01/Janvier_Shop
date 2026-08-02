import { Prisma } from "../../app/generated/prisma/client";

/**
 * The commercial calculation has one intentionally small public surface. All
 * money crosses it as Decimal-compatible text/Prisma.Decimal and is rounded
 * here, never in React components, actions or DTO mappers.
 */
export const commercialCalculationVersion = "janvier-commercial-v1";

const moneyScale = 2;
const percentageScale = 4;
const quantityScale = 4;
const round = Prisma.Decimal.ROUND_HALF_UP;

export type DecimalInput = Prisma.Decimal | string | null | undefined;

export type CommercialBillingType =
  | "ANNUAL"
  | "HOURLY"
  | "INCLUDED"
  | "MONTHLY"
  | "ONE_TIME"
  | "OPTIONAL"
  | "PER_DEVICE"
  | "PER_LOCATION"
  | "PER_SITE"
  | "PER_USER";

export type CommercialLineItemInput = {
  billingType: CommercialBillingType;
  code: string;
  contingencyPercent?: DecimalInput;
  discountType: "FIXED_AMOUNT" | "NONE" | "PERCENTAGE";
  discountValue?: DecimalInput;
  id: string;
  internalCost?: DecimalInput;
  isActive: boolean;
  isIncluded: boolean;
  isOptional: boolean;
  isTaxable: boolean;
  markupPercent?: DecimalInput;
  optionId: string | null;
  pricingMode: "MANUAL" | "MARKUP";
  quantity: DecimalInput;
  scope: "COMMON" | "OPTION_SPECIFIC";
  selectedByDefault: boolean;
  taxIncluded: boolean;
  taxRate?: DecimalInput;
  unitPrice: DecimalInput;
  visibleToClient: boolean;
};

export type CommercialOptionInput = {
  id: string;
  isActive: boolean;
};

export type CommercialPaymentStageInput = {
  calculationType: "FIXED_AMOUNT" | "PERCENTAGE" | "REMAINDER";
  fixedAmount?: DecimalInput;
  id: string;
  optionId: string | null;
  percentage?: DecimalInput;
  position: number;
  visibleToClient: boolean;
};

export type CommercialTotals = {
  discount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
};

export type CalculatedCommercialLineItem = CommercialTotals & {
  adjustedUnitCost: Prisma.Decimal | null;
  baseAmount: Prisma.Decimal;
  grossMarginPercent: Prisma.Decimal | null;
  grossProfit: Prisma.Decimal | null;
  includedInTotal: boolean;
  internalTotalCost: Prisma.Decimal | null;
  markupAmount: Prisma.Decimal | null;
  suggestedUnitPrice: Prisma.Decimal | null;
};

export type CalculatedAlternative = {
  annual: CommercialTotals;
  lines: Array<{ input: CommercialLineItemInput; result: CalculatedCommercialLineItem }>;
  monthly: CommercialTotals;
  oneTime: CommercialTotals;
  optional: CommercialTotals;
  version: typeof commercialCalculationVersion;
};

export type CalculatedPaymentStage = {
  amount: Prisma.Decimal;
  id: string;
  position: number;
};

function decimal(value: DecimalInput, fallback = "0") {
  return new Prisma.Decimal(value ?? fallback);
}

function decimalAt(value: DecimalInput, scale: number) {
  return decimal(value).toDecimalPlaces(scale, round);
}

export function money(value: DecimalInput) {
  return decimal(value).toDecimalPlaces(moneyScale, round);
}

export function quantity(value: DecimalInput) {
  return decimal(value).toDecimalPlaces(quantityScale, round);
}

export function percentage(value: DecimalInput) {
  return decimal(value).toDecimalPlaces(percentageScale, round);
}

export function zeroTotals(): CommercialTotals {
  return {
    discount: money("0"),
    subtotal: money("0"),
    tax: money("0"),
    total: money("0")
  };
}

function addTotals(left: CommercialTotals, right: CommercialTotals): CommercialTotals {
  return {
    discount: money(left.discount.plus(right.discount)),
    subtotal: money(left.subtotal.plus(right.subtotal)),
    tax: money(left.tax.plus(right.tax)),
    total: money(left.total.plus(right.total))
  };
}

function nonNegative(value: Prisma.Decimal) {
  return Prisma.Decimal.max(value, new Prisma.Decimal(0));
}

function isIncludedLine(input: CommercialLineItemInput) {
  return input.isIncluded || input.billingType === "INCLUDED";
}

function isOptionalLine(input: CommercialLineItemInput) {
  return input.isOptional || input.billingType === "OPTIONAL";
}

export function suggestedUnitPrice(
  input: Pick<
    CommercialLineItemInput,
    "contingencyPercent" | "internalCost" | "markupPercent"
  > & { markupPercent?: DecimalInput }
) {
  if (input.internalCost === null || input.internalCost === undefined) {
    return null;
  }
  const adjustedUnitCost = money(
    decimal(input.internalCost).times(
      decimal(input.contingencyPercent).dividedBy(100).plus(1)
    )
  );
  return money(
    adjustedUnitCost.times(decimal(input.markupPercent).dividedBy(100).plus(1))
  );
}

export function calculateCommercialLineItem(
  input: CommercialLineItemInput,
  options: { includeOptional?: boolean } = {}
): CalculatedCommercialLineItem {
  const itemQuantity = quantity(input.quantity);
  const price = money(input.unitPrice);
  const taxRate = percentage(input.taxRate);
  const rawBase = money(itemQuantity.times(price));
  const included = isIncludedLine(input);
  const optional = isOptionalLine(input);
  const includeOptional = options.includeOptional ?? input.selectedByDefault;
  const includedInTotal = input.isActive && (!optional || includeOptional) && !included;

  const discountAmount = included
    ? money("0")
    : input.discountType === "PERCENTAGE"
      ? money(rawBase.times(percentage(input.discountValue)).dividedBy(100))
      : input.discountType === "FIXED_AMOUNT"
        ? money(Prisma.Decimal.min(rawBase, nonNegative(money(input.discountValue))))
        : money("0");
  const afterDiscount = included ? money("0") : money(rawBase.minus(discountAmount));
  const taxable = input.isTaxable && taxRate.greaterThan(0);
  const subtotal = included
    ? money("0")
    : taxable && input.taxIncluded
      ? money(afterDiscount.dividedBy(taxRate.dividedBy(100).plus(1)))
      : afterDiscount;
  const tax = included
    ? money("0")
    : taxable
      ? input.taxIncluded
        ? money(afterDiscount.minus(subtotal))
        : money(subtotal.times(taxRate).dividedBy(100))
      : money("0");
  const total = money(subtotal.plus(tax));

  const hasCost = input.internalCost !== null && input.internalCost !== undefined;
  const adjustedUnitCost = hasCost
    ? money(
        decimal(input.internalCost).times(
          decimal(input.contingencyPercent).dividedBy(100).plus(1)
        )
      )
    : null;
  const internalTotalCost = adjustedUnitCost
    ? money(adjustedUnitCost.times(itemQuantity))
    : null;
  const suggested = suggestedUnitPrice(input);
  const grossProfit = internalTotalCost ? money(subtotal.minus(internalTotalCost)) : null;
  const grossMarginPercent =
    grossProfit && subtotal.greaterThan(0)
      ? decimalAt(grossProfit.dividedBy(subtotal).times(100), percentageScale)
      : null;
  const markupAmount =
    suggested && adjustedUnitCost ? money(suggested.minus(adjustedUnitCost)) : null;

  return {
    adjustedUnitCost,
    baseAmount: included ? money("0") : rawBase,
    discount: discountAmount,
    grossMarginPercent,
    grossProfit,
    includedInTotal,
    internalTotalCost,
    markupAmount,
    suggestedUnitPrice: suggested,
    subtotal,
    tax,
    total
  };
}

function periodFor(input: CommercialLineItemInput) {
  if (input.billingType === "MONTHLY") {
    return "monthly" as const;
  }
  if (input.billingType === "ANNUAL") {
    return "annual" as const;
  }
  return "oneTime" as const;
}

function belongsToAlternative(
  input: CommercialLineItemInput,
  option: CommercialOptionInput | null
) {
  return input.scope === "COMMON" || input.optionId === option?.id;
}

/**
 * Builds independent one-time, monthly and annual buckets. They are never
 * added together: a monthly license is not a one-time implementation cost.
 */
export function calculateAlternative(input: {
  includeOptional?: boolean;
  lineItems: CommercialLineItemInput[];
  option: CommercialOptionInput | null;
}): CalculatedAlternative {
  const result: CalculatedAlternative = {
    annual: zeroTotals(),
    lines: [],
    monthly: zeroTotals(),
    oneTime: zeroTotals(),
    optional: zeroTotals(),
    version: commercialCalculationVersion
  };

  for (const lineItem of input.lineItems) {
    if (
      !lineItem.visibleToClient ||
      !lineItem.isActive ||
      !belongsToAlternative(lineItem, input.option)
    ) {
      continue;
    }
    const optional = isOptionalLine(lineItem);
    const calculation = calculateCommercialLineItem(lineItem, {
      includeOptional: input.includeOptional ?? lineItem.selectedByDefault
    });
    result.lines.push({ input: lineItem, result: calculation });
    const bucket = periodFor(lineItem);
    if (optional) {
      result.optional = addTotals(result.optional, calculation);
    }
    if (calculation.includedInTotal) {
      result[bucket] = addTotals(result[bucket], calculation);
    }
  }
  return result;
}

/** Payment stages only schedule the selected alternative's one-time total. */
export function calculatePaymentSchedule(input: {
  stages: CommercialPaymentStageInput[];
  total: DecimalInput;
}): CalculatedPaymentStage[] {
  const total = money(input.total);
  const ordered = [...input.stages].sort((left, right) => left.position - right.position);
  let allocated = money("0");
  return ordered.map((stage) => {
    const amount =
      stage.calculationType === "PERCENTAGE"
        ? money(total.times(percentage(stage.percentage)).dividedBy(100))
        : stage.calculationType === "FIXED_AMOUNT"
          ? money(stage.fixedAmount)
          : money(Prisma.Decimal.max(total.minus(allocated), new Prisma.Decimal(0)));
    allocated = money(allocated.plus(amount));
    return { amount, id: stage.id, position: stage.position };
  });
}

export function decimalText(value: DecimalInput, scale = moneyScale) {
  return decimalAt(value, scale).toFixed(scale);
}
