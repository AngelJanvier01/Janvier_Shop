import { describe, expect, it } from "vitest";

import {
  calculateAlternative,
  calculateCommercialLineItem,
  calculatePaymentSchedule,
  decimalText
} from "../../lib/proposals/commercial-calculator";
import {
  CommercialValidationError,
  validateCommercialRevision
} from "../../lib/proposals/commercial-validation";

const baseLine = {
  billingType: "ONE_TIME" as const,
  code: "IMPLEMENTATION",
  contingencyPercent: null,
  discountType: "NONE" as const,
  discountValue: "0",
  id: "line-1",
  internalCost: null,
  isActive: true,
  isIncluded: false,
  isOptional: false,
  isTaxable: true,
  markupPercent: null,
  optionId: "core",
  pricingMode: "MANUAL" as const,
  quantity: "1",
  scope: "OPTION_SPECIFIC" as const,
  selectedByDefault: false,
  taxIncluded: false,
  taxRate: "16",
  unitPrice: "1000",
  visibleToClient: true
};

describe("commercial calculator", () => {
  it("calcula markup sobre costo, contingencia y margen bruto real", () => {
    const result = calculateCommercialLineItem({
      ...baseLine,
      contingencyPercent: "10",
      internalCost: "1000",
      markupPercent: "40",
      pricingMode: "MARKUP",
      unitPrice: "1540"
    });

    expect(decimalText(result.suggestedUnitPrice)).toBe("1540.00");
    expect(decimalText(result.internalTotalCost)).toBe("1100.00");
    expect(decimalText(result.grossProfit)).toBe("440.00");
    expect(decimalText(result.grossMarginPercent, 4)).toBe("28.5714");
    expect(decimalText(result.tax)).toBe("246.40");
    expect(decimalText(result.total)).toBe("1786.40");
  });

  it("aplica descuentos antes del impuesto y extrae impuesto incluido", () => {
    const percentage = calculateCommercialLineItem({
      ...baseLine,
      discountType: "PERCENTAGE",
      discountValue: "10",
      quantity: "2",
      unitPrice: "100"
    });
    const inclusive = calculateCommercialLineItem({
      ...baseLine,
      taxIncluded: true,
      unitPrice: "116"
    });

    expect(decimalText(percentage.baseAmount)).toBe("200.00");
    expect(decimalText(percentage.discount)).toBe("20.00");
    expect(decimalText(percentage.subtotal)).toBe("180.00");
    expect(decimalText(percentage.tax)).toBe("28.80");
    expect(decimalText(inclusive.subtotal)).toBe("100.00");
    expect(decimalText(inclusive.tax)).toBe("16.00");
    expect(decimalText(inclusive.total)).toBe("116.00");
  });

  it("no suma opcionales ni incluidos sin una selección explícita", () => {
    const optionalInput = {
      ...baseLine,
      billingType: "OPTIONAL" as const,
      isOptional: true,
      isTaxable: false,
      taxRate: "0"
    };
    const optional = calculateCommercialLineItem(optionalInput);
    const included = calculateCommercialLineItem({
      ...baseLine,
      billingType: "INCLUDED",
      isIncluded: true
    });

    expect(optional.includedInTotal).toBe(false);
    expect(
      calculateCommercialLineItem(optionalInput, { includeOptional: true })
        .includedInTotal
    ).toBe(true);
    expect(decimalText(included.total)).toBe("0.00");
  });

  it("separa pago único, mensual y anual por alternativa con conceptos comunes", () => {
    const totals = calculateAlternative({
      option: { id: "core", isActive: true },
      lineItems: [
        { ...baseLine, optionId: null, scope: "COMMON", taxRate: "0" },
        {
          ...baseLine,
          code: "LICENSE",
          billingType: "MONTHLY",
          optionId: "core",
          taxRate: "0",
          unitPrice: "80"
        },
        {
          ...baseLine,
          code: "SUPPORT",
          billingType: "ANNUAL",
          optionId: "core",
          taxRate: "0",
          unitPrice: "500"
        }
      ]
    });

    expect(decimalText(totals.oneTime.total)).toBe("1000.00");
    expect(decimalText(totals.monthly.total)).toBe("80.00");
    expect(decimalText(totals.annual.total)).toBe("500.00");
  });

  it("resuelve un esquema 40/30/remainder sin crear pagos", () => {
    const stages = calculatePaymentSchedule({
      total: "1000",
      stages: [
        {
          calculationType: "PERCENTAGE",
          id: "a",
          percentage: "40",
          position: 1,
          optionId: null,
          visibleToClient: true
        },
        {
          calculationType: "PERCENTAGE",
          id: "b",
          percentage: "30",
          position: 2,
          optionId: null,
          visibleToClient: true
        },
        {
          calculationType: "REMAINDER",
          id: "c",
          position: 3,
          optionId: null,
          visibleToClient: true
        }
      ]
    });
    expect(stages.map((stage) => decimalText(stage.amount))).toEqual([
      "400.00",
      "300.00",
      "300.00"
    ]);
  });

  it("rechaza ciclos de cronograma y dos alternativas recomendadas", () => {
    const input = {
      currency: "MXN",
      deliveryTerms: null,
      expectedCommercialVersion: 1,
      lineItems: [
        {
          ...baseLine,
          description: null,
          internalNotes: null,
          name: "Implementación",
          optionCode: "CORE",
          supplier: null,
          supplierReference: null,
          unit: "service"
        }
      ],
      options: [
        {
          code: "CORE",
          conditionsSummary: null,
          description: null,
          estimatedDuration: null,
          isActive: true,
          recommended: true,
          supportSummary: null,
          title: "Core"
        },
        {
          code: "SCALE",
          conditionsSummary: null,
          description: null,
          estimatedDuration: null,
          isActive: true,
          recommended: true,
          supportSummary: null,
          title: "Scale"
        }
      ],
      paymentStages: [],
      paymentTermsSummary: null,
      supportSummary: null,
      taxDisplayMode: "EXCLUSIVE" as const,
      timelinePhases: [
        {
          code: "A",
          dependsOnCodes: ["B"],
          deliverables: [],
          description: null,
          durationUnit: "WEEK" as const,
          durationValue: 1,
          estimatedEndDate: null,
          estimatedStartDate: null,
          isOptional: false,
          optionCode: null,
          title: "A",
          visibleToClient: true
        },
        {
          code: "B",
          dependsOnCodes: ["A"],
          deliverables: [],
          description: null,
          durationUnit: "WEEK" as const,
          durationValue: 1,
          estimatedEndDate: null,
          estimatedStartDate: null,
          isOptional: false,
          optionCode: null,
          title: "B",
          visibleToClient: true
        }
      ],
      validUntil: null,
      warrantySummary: null
    };

    expect(() => validateCommercialRevision(input)).toThrow(CommercialValidationError);
  });
});
