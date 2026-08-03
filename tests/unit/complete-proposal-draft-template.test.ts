import { describe, expect, it } from "vitest";

import { createCompleteProposalDraftTemplate } from "../../lib/proposals/markdown/complete-draft-template";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

describe("plantilla completa de Proposal DRAFT", () => {
  it("genera una fuente segura con los bloques editoriales y comerciales disponibles", () => {
    const source = createCompleteProposalDraftTemplate({
      clientName: "Mariana López",
      companyName: "Operadora Norte",
      context: "Necesitamos reducir errores operativos y documentar la ruta de entrega.",
      title: "Sistema operativo de ejemplo"
    });
    const parsed = parseJanvierMarkdown(source);
    const document = JSON.stringify(parsed.document);

    expect(parsed.status).toBe("VALID");
    expect(parsed.document.sections).toHaveLength(13);
    expect(source).toContain("asset:architecture-diagram");
    expect(source).toContain("{{proposal.options}}");
    expect(source).toContain("{{proposal.lineItems}}");
    expect(source).toContain("{{proposal.paymentSchedule}}");
    expect(document).toContain("janvier-callout");
    expect(document).toContain("janvier-metrics");
    expect(document).toContain("janvier-decision");
    expect(document).toContain("janvier-ascii");
    expect(document).toContain("janvier-page-break");
    expect(document).toContain("janvier-internal");
  });
});
