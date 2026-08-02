import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JanvierMarkdownRenderer } from "../../components/proposals/janvier-markdown-renderer";
import {
  assertPublicCommercialPrivacy,
  publicProposalCommercialSchema
} from "../../lib/proposals/commercial-dto";
import {
  buildPublicJanvierDocument,
  parseJanvierMarkdown
} from "../../lib/proposals/markdown";

const commercial = publicProposalCommercialSchema.parse({
  alternatives: [
    {
      annual: { discount: "0.00", subtotal: "0.00", tax: "0.00", total: "0.00" },
      code: "CORE",
      conditionsSummary: null,
      description: "Base operativa.",
      estimatedDuration: "4 semanas",
      id: "option-core",
      lineItems: [
        {
          billingType: "ONE_TIME",
          code: "IMPLEMENTATION",
          description: null,
          discount: "0.00",
          id: "line-implementation",
          isIncluded: false,
          isOptional: false,
          name: "Implementación",
          quantity: "1.0000",
          tax: "160.00",
          total: "1160.00",
          unit: "service",
          unitPrice: "1000.00"
        }
      ],
      monthly: { discount: "0.00", subtotal: "0.00", tax: "0.00", total: "0.00" },
      oneTime: { discount: "0.00", subtotal: "1000.00", tax: "160.00", total: "1160.00" },
      optional: { discount: "0.00", subtotal: "0.00", tax: "0.00", total: "0.00" },
      recommended: true,
      supportSummary: null,
      title: "Core"
    }
  ],
  calculationVersion: "janvier-commercial-v1",
  currency: "MXN",
  lineItems: [
    {
      billingType: "ONE_TIME",
      code: "IMPLEMENTATION",
      description: null,
      discount: "0.00",
      id: "line-implementation",
      isIncluded: false,
      isOptional: false,
      name: "Implementación",
      quantity: "1.0000",
      tax: "160.00",
      total: "1160.00",
      unit: "service",
      unitPrice: "1000.00"
    }
  ],
  paymentSchedule: [
    {
      amount: "464.00",
      description: null,
      dueDays: null,
      optionCode: "CORE",
      percentage: "40.0000",
      title: "Anticipo",
      triggerDescription: "Al aceptar",
      triggerType: "ACCEPTANCE"
    }
  ],
  terms: {
    deliveryTerms: null,
    paymentTermsSummary: null,
    supportSummary: null,
    validUntil: "2026-09-01",
    warrantySummary: null
  },
  timeline: [
    {
      code: "DISCOVERY",
      deliverables: [{ description: null, title: "Diagnóstico" }],
      dependencies: [],
      description: null,
      duration: "1 WEEK",
      isOptional: false,
      optionCode: "CORE",
      title: "Descubrimiento"
    }
  ]
});

describe("commercial markdown markers", () => {
  it("acepta los cinco marcadores únicamente como párrafos completos", () => {
    const parsed = parseJanvierMarkdown(
      [
        "# Propuesta",
        "",
        "{{proposal.options}}",
        "",
        "{{proposal.lineItems}}",
        "",
        "{{proposal.timeline}}",
        "",
        "{{proposal.paymentSchedule}}",
        "",
        "{{proposal.totals}}"
      ].join("\n")
    );
    expect(parsed.status).toBe("VALID");
    expect(
      parsed.document.variables.filter((variable) => variable.structural)
    ).toHaveLength(5);
  });

  it("renderiza componentes estructurados y no filtra campos internos", () => {
    const parsed = parseJanvierMarkdown(
      [
        "# Propuesta",
        "",
        "{{proposal.options}}",
        "",
        "{{proposal.lineItems}}",
        "",
        "{{proposal.timeline}}",
        "",
        "{{proposal.paymentSchedule}}",
        "",
        "{{proposal.totals}}"
      ].join("\n")
    );
    const document = buildPublicJanvierDocument(parsed.document, { commercial });
    assertPublicCommercialPrivacy(commercial);
    const serialized = JSON.stringify(document);
    const html = renderToStaticMarkup(
      createElement(JanvierMarkdownRenderer, { document })
    );

    expect(html).toContain('data-testid="proposal-options-comparison"');
    expect(html).toContain('data-testid="proposal-line-items-table"');
    expect(html).toContain('data-testid="proposal-timeline"');
    expect(html).toContain('data-testid="proposal-payment-schedule"');
    expect(html).toContain('data-testid="proposal-totals-summary"');
    for (const forbidden of [
      "internalCost",
      "markupPercent",
      "supplier",
      "grossProfit"
    ]) {
      expect(serialized).not.toContain(forbidden);
      expect(html).not.toContain(forbidden);
    }
  });
});
