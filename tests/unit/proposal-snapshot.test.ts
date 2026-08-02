import { describe, expect, it } from "vitest";

import { buildProposalAcceptanceSnapshot } from "../../lib/proposals/proposal-snapshot";

function snapshotInput() {
  return {
    currency: "MXN",
    fallbackInvestment: "999.00",
    lineItems: [
      {
        code: "IMPL-01",
        description: "Implementación base",
        discount: "10",
        // Los campos internos pueden existir en el objeto de origen, pero no forman parte
        // del contrato aceptado ni del snapshot público.
        internalCost: "25",
        internalNotes: "Nunca debe aparecer",
        markupPercent: "300",
        optionId: "option-base",
        position: 1,
        quantity: "2",
        taxRate: "16",
        type: "ONE_TIME",
        unitPrice: "100",
        visibleForClient: true
      },
      {
        code: "INT-01",
        description: "Trabajo interno",
        discount: "0",
        internalCost: "300",
        internalNotes: "Confidencial",
        markupPercent: "20",
        optionId: null,
        position: 2,
        quantity: "1",
        taxRate: "0",
        type: "ONE_TIME",
        unitPrice: "900",
        visibleForClient: false
      }
    ],
    revision: 4,
    sections: [
      { content: "Objetivo aprobado.", position: 1, title: "Contexto", type: "CONTEXT" }
    ],
    selectedOption: {
      code: "BASE",
      description: "Alternativa elegida",
      id: "option-base",
      investment: "190",
      taxIncluded: false,
      title: "Base"
    },
    terms: "Pago contra entrega.",
    title: "Implementación JANVIER"
  };
}

describe("proposal acceptance snapshot", () => {
  it("calcula con Decimal en servidor y conserva el contenido visible", () => {
    const result = buildProposalAcceptanceSnapshot(snapshotInput());

    expect(result.totals.subtotal.toFixed(2)).toBe("190.00");
    expect(result.totals.tax.toFixed(2)).toBe("30.40");
    expect(result.totals.total.toFixed(2)).toBe("220.40");
    expect(result.snapshot).toMatchObject({
      alternative: { code: "BASE" },
      lineItems: [{ code: "IMPL-01", quantity: "2.000" }],
      totals: { subtotal: "190.00", tax: "30.40", total: "220.40" }
    });
  });

  it("cambia el hash si cambia contenido aceptable", () => {
    const original = buildProposalAcceptanceSnapshot(snapshotInput());
    const changedInput = snapshotInput();
    changedInput.sections[0].content = "Objetivo aprobado con alcance extendido.";
    const changed = buildProposalAcceptanceSnapshot(changedInput);

    expect(changed.contentHash).not.toBe(original.contentHash);
  });

  it("no incluye costos, markup ni notas internas en el snapshot", () => {
    const result = buildProposalAcceptanceSnapshot(snapshotInput());
    const serialized = JSON.stringify(result.snapshot);

    expect(serialized).not.toContain("internalCost");
    expect(serialized).not.toContain("internalNotes");
    expect(serialized).not.toContain("markupPercent");
    expect(serialized).not.toContain("Confidencial");
  });
});
