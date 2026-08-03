import { describe, expect, it } from "vitest";
import { buildFrozenProposalEvidence } from "../../lib/proposals/markdown/freeze";

const input = () => ({
  fullAssetManifest: [{ alias: "plan", sha256: "a".repeat(64) }],
  generation: { generatedAt: "2026-08-02T00:00:00.000Z", rendererVersion: "janvier-v1" },
  normalizedAst: { sections: [] },
  parserVersion: "janvier-markdown-v1",
  privateDocument: { internal: "nota" },
  publicDocument: { sections: [{ title: "Alcance" }] },
  publicFacts: {
    alternative: null,
    commercial: { total: "100.00" },
    currency: "MXN",
    revision: 1,
    validUntil: "2026-08-16"
  },
  resolvedVariables: { currentDate: "2 de agosto de 2026" },
  sourceHash: "b".repeat(64),
  sourceMarkdown: "# Propuesta"
});

describe("frozen proposal evidence", () => {
  it("cambia evidencia interna sin alterar el hash publico", () => {
    const base = buildFrozenProposalEvidence(input());
    const changed = buildFrozenProposalEvidence({
      ...input(),
      privateDocument: { internal: "otra nota" }
    });
    expect(changed.publicContentHash).toBe(base.publicContentHash);
    expect(changed.evidenceHash).not.toBe(base.evidenceHash);
  });
  it("cambia ambos hashes si cambia lo que ve el cliente", () => {
    const base = buildFrozenProposalEvidence(input());
    const changed = buildFrozenProposalEvidence({
      ...input(),
      publicDocument: { sections: [{ title: "Nuevo alcance" }] }
    });
    expect(changed.publicContentHash).not.toBe(base.publicContentHash);
    expect(changed.evidenceHash).not.toBe(base.evidenceHash);
  });

  it("no incorpora evidencia interna dentro del paquete público", () => {
    const result = buildFrozenProposalEvidence(input());
    expect(JSON.stringify(result.publicSnapshot)).not.toContain("nota");
    expect(JSON.stringify(result.privateEvidence)).toContain("nota");
  });
});
