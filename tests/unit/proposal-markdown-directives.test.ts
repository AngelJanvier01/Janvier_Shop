import { describe, expect, it } from "vitest";

import { parseJanvierMarkdown } from "../../lib/proposals/markdown";

function sourceWithDirective(directive: string) {
  return ["# Propuesta", "", "## Contexto {#context type=CONTEXT}", "", directive].join(
    "\n"
  );
}

function codes(source: string) {
  return parseJanvierMarkdown(source).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("directivas JANVIER", () => {
  it("valida janvier-callout y elimina atributos desconocidos del AST", () => {
    const valid = parseJanvierMarkdown(
      sourceWithDirective(
        [
          ":::janvier-callout",
          "type: signal",
          "title: Nota técnica",
          "",
          "Contenido seguro.",
          ":::"
        ].join("\n")
      )
    );
    const unknownAttribute = parseJanvierMarkdown(
      sourceWithDirective(
        [
          ":::janvier-callout",
          "type: nope",
          "unknown: no debe persistir",
          "",
          "Texto.",
          ":::"
        ].join("\n")
      )
    );

    expect(valid.status).toBe("VALID");
    expect(valid.document.sections[0]?.content[0]).toMatchObject({
      attributes: { title: "Nota técnica", type: "signal" },
      name: "janvier-callout"
    });
    expect(codes(unknownAttribute.normalizedSource)).toEqual(
      expect.arrayContaining(["INVALID_CALLOUT", "INVALID_DIRECTIVE_ATTRIBUTE"])
    );
    expect(JSON.stringify(unknownAttribute.document)).not.toContain("unknown");
  });

  it("valida entre uno y doce pares de janvier-metrics", () => {
    const valid = sourceWithDirective(
      [":::janvier-metrics", "", "- label: Usuarios", "  value: 600+", ":::"].join("\n")
    );
    const incomplete = sourceWithDirective(
      [":::janvier-metrics", "", "- label: Usuarios", ":::"].join("\n")
    );
    const tooMany = sourceWithDirective(
      [
        ":::janvier-metrics",
        "",
        ...Array.from({ length: 13 }, (_, index) =>
          ["- label: Métrica " + index, "  value: " + index].join("\n")
        ),
        ":::"
      ].join("\n")
    );
    const attributes = sourceWithDirective(
      [
        ":::janvier-metrics{variant=signal}",
        "",
        "- label: Usuarios",
        "  value: 600+",
        ":::"
      ].join("\n")
    );

    expect(parseJanvierMarkdown(valid).status).toBe("VALID");
    expect(codes(incomplete)).toContain("INVALID_METRICS");
    expect(codes(tooMany)).toContain("INVALID_METRICS");
    expect(codes(attributes)).toContain("INVALID_METRICS");
  });

  it("requiere título y cuerpo seguro para janvier-decision", () => {
    const valid = sourceWithDirective(
      [
        ":::janvier-decision",
        "title: Aprobar arquitectura",
        "",
        "La decisión conserva Markdown **seguro**.",
        ":::"
      ].join("\n")
    );
    const missingTitle = sourceWithDirective(
      [":::janvier-decision", "", "Cuerpo.", ":::"].join("\n")
    );
    const unknownAttribute = sourceWithDirective(
      [":::janvier-decision", "title: Sí", "priority: urgent", "", "Cuerpo.", ":::"].join(
        "\n"
      )
    );

    expect(parseJanvierMarkdown(valid).status).toBe("VALID");
    expect(codes(missingTitle)).toContain("INVALID_DECISION");
    expect(codes(unknownAttribute)).toContain("INVALID_DIRECTIVE_ATTRIBUTE");
  });

  it("limita janvier-ascii a texto ASCII seguro y sin atributos", () => {
    const valid = sourceWithDirective(
      [":::janvier-ascii", "SYSTEM_READY = 1", ":::"].join("\n")
    );
    const tooLong = sourceWithDirective(
      [":::janvier-ascii", "A".repeat(2001), ":::"].join("\n")
    );
    const nonAscii = sourceWithDirective([":::janvier-ascii", "SEÑAL", ":::"].join("\n"));
    const attributes = sourceWithDirective(
      [":::janvier-ascii{tone=signal}", "READY", ":::"].join("\n")
    );

    expect(parseJanvierMarkdown(valid).status).toBe("VALID");
    expect(codes(tooLong)).toContain("INVALID_ASCII_DIRECTIVE");
    expect(codes(nonAscii)).toContain("INVALID_ASCII_DIRECTIVE");
    expect(codes(attributes)).toContain("INVALID_ASCII_DIRECTIVE");
  });

  it("mantiene janvier-page-break vacío y rechaza contenido o atributos", () => {
    const valid = sourceWithDirective(":::janvier-page-break\n:::");
    const content = sourceWithDirective(":::janvier-page-break\nTexto\n:::");
    const attributes = sourceWithDirective(":::janvier-page-break{after=cover}\n:::");

    expect(parseJanvierMarkdown(valid).status).toBe("VALID");
    expect(codes(content)).toContain("INVALID_PAGE_BREAK");
    expect(codes(attributes)).toContain("INVALID_DIRECTIVE_ATTRIBUTE");
  });

  it("conserva el marcador janvier-internal y rechaza atributos o anidamiento", () => {
    const valid = parseJanvierMarkdown(
      sourceWithDirective(":::janvier-internal\nNota administrativa.\n:::")
    );
    const attributes = sourceWithDirective(
      ":::janvier-internal{scope=admin}\nNota.\n:::"
    );
    const nested = sourceWithDirective(
      [
        ":::janvier-internal",
        ":::janvier-callout",
        "type: info",
        "",
        "No permitido.",
        ":::",
        ":::"
      ].join("\n")
    );

    expect(valid.status).toBe("VALID");
    expect(valid.document.sections[0]?.content[0]).toMatchObject({
      name: "janvier-internal",
      type: "directive"
    });
    expect(codes(attributes)).toContain("INVALID_DIRECTIVE_ATTRIBUTE");
    expect(codes(nested)).toContain("NESTED_DIRECTIVE");
  });
});
