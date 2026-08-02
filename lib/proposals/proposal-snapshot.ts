import { createHash } from "node:crypto";

import { Prisma } from "../../app/generated/prisma/client";

const nonBillableLineItemTypes = new Set(["INCLUDED", "OPTIONAL"]);

type DecimalInput = Prisma.Decimal | string | number | null | undefined;

export type SnapshotSection = {
  content: string | null;
  position: number;
  title: string;
  type: string;
};

export type SnapshotOption = {
  code: string;
  description: string | null;
  id: string;
  investment: DecimalInput;
  taxIncluded: boolean;
  title: string;
};

export type SnapshotLineItem = {
  code: string;
  description: string;
  discount: DecimalInput;
  optionId: string | null;
  position: number;
  quantity: DecimalInput;
  taxRate: DecimalInput;
  type: string;
  unitPrice: DecimalInput;
  visibleForClient: boolean;
};

function decimal(value: DecimalInput) {
  return new Prisma.Decimal(value ?? 0);
}

function decimalText(value: DecimalInput, decimals = 2) {
  return decimal(value).toFixed(decimals);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function calculateProposalTotals(input: {
  fallbackInvestment: DecimalInput;
  lineItems: SnapshotLineItem[];
  selectedOption: SnapshotOption | null;
}) {
  const applicable = input.lineItems.filter(
    (lineItem) =>
      lineItem.visibleForClient &&
      (lineItem.optionId === null || lineItem.optionId === input.selectedOption?.id) &&
      !nonBillableLineItemTypes.has(lineItem.type)
  );

  if (!applicable.length) {
    const subtotal = decimal(
      input.selectedOption?.investment ?? input.fallbackInvestment
    );
    return { subtotal, tax: new Prisma.Decimal(0), total: subtotal };
  }

  return applicable.reduce(
    (totals, lineItem) => {
      const beforeTax = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        decimal(lineItem.quantity)
          .times(decimal(lineItem.unitPrice))
          .minus(decimal(lineItem.discount))
      );
      const tax = beforeTax.times(decimal(lineItem.taxRate)).dividedBy(100);
      return {
        subtotal: totals.subtotal.plus(beforeTax),
        tax: totals.tax.plus(tax),
        total: totals.total.plus(beforeTax).plus(tax)
      };
    },
    {
      subtotal: new Prisma.Decimal(0),
      tax: new Prisma.Decimal(0),
      total: new Prisma.Decimal(0)
    }
  );
}

export function buildProposalAcceptanceSnapshot(input: {
  currency: string;
  fallbackInvestment: DecimalInput;
  lineItems: SnapshotLineItem[];
  revision: number;
  sections: SnapshotSection[];
  selectedOption: SnapshotOption | null;
  terms: string | null;
  title: string;
}) {
  const visibleLineItems = input.lineItems
    .filter((lineItem) => lineItem.visibleForClient)
    .sort((left, right) => left.position - right.position)
    .map((lineItem) => ({
      code: lineItem.code,
      description: lineItem.description,
      discount: decimalText(lineItem.discount),
      optionId: lineItem.optionId,
      position: lineItem.position,
      quantity: decimalText(lineItem.quantity, 3),
      taxRate: decimalText(lineItem.taxRate, 4),
      type: lineItem.type,
      unitPrice: decimalText(lineItem.unitPrice)
    }));
  const totals = calculateProposalTotals(input);
  const snapshot = {
    alternative: input.selectedOption
      ? {
          code: input.selectedOption.code,
          description: input.selectedOption.description,
          id: input.selectedOption.id,
          investment: decimalText(input.selectedOption.investment),
          taxIncluded: input.selectedOption.taxIncluded,
          title: input.selectedOption.title
        }
      : null,
    currency: input.currency,
    lineItems: visibleLineItems,
    revision: input.revision,
    sections: input.sections
      .sort((left, right) => left.position - right.position)
      .map((section) => ({
        content: section.content,
        position: section.position,
        title: section.title,
        type: section.type
      })),
    terms: input.terms,
    title: input.title,
    totals: {
      subtotal: totals.subtotal.toFixed(2),
      tax: totals.tax.toFixed(2),
      total: totals.total.toFixed(2)
    }
  };
  const canonical = canonicalJson(snapshot);
  return {
    contentHash: createHash("sha256").update(canonical).digest("hex"),
    snapshot,
    totals
  };
}
