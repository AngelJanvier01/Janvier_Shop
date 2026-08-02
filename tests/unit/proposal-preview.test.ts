import { describe, expect, it } from "vitest";

import { publicProposalCommercialSchema } from "../../lib/proposals/commercial-dto";
import {
  buildPublicJanvierDocument,
  parseJanvierMarkdown
} from "../../lib/proposals/markdown";
import {
  assertProposalPreviewPrivacy,
  buildProposalPreviewModel
} from "../../lib/proposals/preview";

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
  paymentSchedule: [],
  terms: {
    deliveryTerms: null,
    paymentTermsSummary: null,
    supportSummary: null,
    validUntil: "2026-09-01",
    warrantySummary: null
  },
  timeline: []
});

function modelFor(source: string, companyName = "Operadora Norte") {
  const parsed = parseJanvierMarkdown(source);
  expect(parsed.status).toBe("VALID");
  const publicDocument = buildPublicJanvierDocument(parsed.document, {
    commercial,
    selectedAlternativeCode: "CORE",
    variableContext: {
      client: { companyName, contactName: "Mariana", email: "mariana@example.test" },
      currentDate: "2 de agosto de 2026",
      proposal: { currency: "MXN", reference: "PREVIEW-01", title: "Preview QA" }
    }
  });
  return buildProposalPreviewModel({
    assetReport: {
      missingAliases: [],
      requiredMissingAliases: [],
      unresolvedAltAliases: [],
      unusedAliases: [],
      usedAliases: []
    },
    commercial,
    document: parsed.document,
    proposal: { id: "proposal-1", reference: "PREVIEW-01", status: "DRAFT" },
    publicDocument,
    revision: {
      commercialVersion: 4,
      id: "revision-1",
      markdownVersion: 2,
      number: 1,
      title: "Preview QA"
    }
  });
}

const completeSource = [
  "# Preview QA",
  "",
  "Hola {{client.companyName}}.",
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
].join("\n");

describe("ProposalPreviewModel", () => {
  it("construye un modelo público con variables dinámicas y marcadores únicos", () => {
    const model = modelFor(completeSource);

    expect(model.resolvedVariables.values["client.companyName"]).toBe("Operadora Norte");
    expect(model.resolvedVariables.missing).toEqual([]);
    expect(model.validation.structuralMarkers["proposal.options"]).toBe(1);
    expect(model.validation.status).toBe("READY_TO_SHARE");
    expect(JSON.stringify(model)).not.toContain("internalCost");
    expect(JSON.stringify(model)).not.toContain("storageKey");
  });

  it("diagnostica variables faltantes y marcadores ausentes sin inventar datos", () => {
    const model = modelFor("# Preview QA\n\nHola {{client.companyName}}.", "");

    expect(model.resolvedVariables.missing).toContain("client.companyName");
    expect(model.validation.status).toBe("READY_WITH_WARNINGS");
    expect(model.validation.issues.map((issue) => issue.code)).toContain(
      "STRUCTURAL_MARKER_MISSING"
    );
  });

  it("rechaza marcadores duplicados y cualquier ampliación privada accidental", () => {
    const model = modelFor(`${completeSource}\n\n{{proposal.options}}`);

    expect(model.validation.status).toBe("INCOMPLETE");
    expect(model.validation.issues.map((issue) => issue.code)).toContain(
      "STRUCTURAL_MARKER_DUPLICATED"
    );
    expect(() =>
      assertProposalPreviewPrivacy({ ...model, supplier: "no permitido" } as never)
    ).toThrow("supplier");
  });
});
