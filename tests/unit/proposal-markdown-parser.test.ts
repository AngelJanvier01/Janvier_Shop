import { describe, expect, it } from "vitest";

import {
  generateLegacyMarkdownSource,
  hashMarkdownSource,
  parseJanvierMarkdown
} from "../../lib/proposals/markdown";

const validSource = [
  "---",
  "title: Sistema de gestión comercial",
  "language: es",
  "tags: [operación, software]",
  "---",
  "",
  "# Sistema de gestión comercial",
  "",
  "## Resumen ejecutivo {#summary type=EXECUTIVE_SUMMARY}",
  "",
  "Preparado para {{client.companyName}}.",
  "",
  ":::janvier-callout",
  "type: info",
  "title: Nota técnica",
  "",
  "Contenido seguro.",
  ":::",
  "",
  "## Solución propuesta {#solution type=SOLUTION}",
  "",
  "{{proposal.options}}",
  "",
  "## Condiciones {#conditions type=CONDITIONS}",
  "",
  "Vigencia: {{proposal.validUntil}}."
].join("\n");

function diagnosticCodes(source: string | Uint8Array) {
  return parseJanvierMarkdown(source).diagnostics.map((item) => item.code);
}

describe("parseJanvierMarkdown", () => {
  it("normaliza CommonMark/GFM seguro con secciones, directivas y variables", () => {
    const result = parseJanvierMarkdown(validSource);

    expect(result.status).toBe("VALID");
    expect(result.document.frontMatter?.title).toBe("Sistema de gestión comercial");
    expect(result.document.sections).toHaveLength(3);
    expect(result.document.sections[0]).toMatchObject({
      sourceId: "summary",
      storageType: "EXECUTIVE_SUMMARY",
      type: "EXECUTIVE_SUMMARY"
    });
    expect(result.document.sections[2]).toMatchObject({
      sourceId: "conditions",
      storageType: "TERMS",
      type: "CONDITIONS"
    });
    expect(result.document.variables.map((item) => item.name)).toEqual([
      "client.companyName",
      "proposal.options",
      "proposal.validUntil"
    ]);
    expect(result.document.sections[0].content[1]).toMatchObject({
      attributes: { title: "Nota técnica", type: "info" },
      name: "janvier-callout",
      type: "directive"
    });
  });

  it("acepta BOM UTF-8 y conserva una variable escapada como texto literal", () => {
    const source =
      "\uFEFF# Título\n\n## Contexto {#context type=CONTEXT}\n\n\\{{client.companyName}}";
    const result = parseJanvierMarkdown(source);

    expect(result.status).toBe("VALID");
    expect(result.normalizedSource.startsWith("\uFEFF")).toBe(false);
    expect(result.document.variables).toEqual([]);
    expect(JSON.stringify(result.document)).toContain("{{client.companyName}}");
  });

  it("rechaza HTML crudo, enlaces peligrosos y rutas de imagen no privadas", () => {
    const source = [
      "# Seguridad",
      "",
      "## Contexto {#context type=CONTEXT}",
      "",
      "<script>alert(1)</script>",
      "",
      "[Ejecutar](javascript:alert(1))",
      "",
      "![Local](file:///C:/Users/angel/secreto.png)"
    ].join("\n");
    const result = parseJanvierMarkdown(source);

    expect(result.status).toBe("ERROR");
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "RAW_HTML_NOT_ALLOWED",
        "UNSAFE_LINK",
        "INVALID_ASSET_REFERENCE"
      ])
    );
    expect(JSON.stringify(result.document)).not.toContain("<script>");
    expect(JSON.stringify(result.document)).not.toContain("javascript:alert");
  });

  it("protege front matter, identificadores y directivas con diagnóstico localizado", () => {
    const source = [
      "---",
      "currency: MXN",
      "---",
      "",
      "# Propuesta",
      "",
      "## A {#same type=CONTEXT}",
      "",
      "Texto",
      "",
      "## B {#same type=NOPE}",
      "",
      ":::janvier-callout",
      "type: unknown",
      "",
      "Texto",
      ":::"
    ].join("\n");
    const result = parseJanvierMarkdown(source);
    const duplicate = result.diagnostics.find(
      (item) => item.code === "DUPLICATE_SECTION_ID"
    );

    expect(result.status).toBe("ERROR");
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "FORBIDDEN_FRONT_MATTER_KEY",
        "DUPLICATE_SECTION_ID",
        "INVALID_SECTION_TYPE",
        "INVALID_CALLOUT"
      ])
    );
    expect(duplicate?.line).toBeGreaterThan(1);
    expect(duplicate?.column).toBeGreaterThan(0);
  });

  it("acepta GFM y rechaza aliases YAML antes de crear el AST", () => {
    const gfm = [
      "# Propuesta",
      "",
      "## Alcance {#scope type=SCOPE}",
      "",
      "- [x] Operación",
      "",
      "| Fase | Duración |",
      "| --- | --- |",
      "| Diseño | 2 semanas |"
    ].join("\n");
    const aliases = [
      "---",
      "title: &shared Propuesta",
      "subtitle: *shared",
      "---",
      "",
      "# Propuesta",
      "",
      "## Contexto {#context type=CONTEXT}"
    ].join("\n");

    expect(parseJanvierMarkdown(gfm).status).toBe("VALID");
    expect(diagnosticCodes(aliases)).toContain("INVALID_FRONT_MATTER");
  });

  it("aplica límites a referencias de activos", () => {
    const assets = Array.from(
      { length: 51 },
      (_, index) => "![A](asset:item-" + index + ")"
    ).join("\n\n");
    const source = "# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\n" + assets;

    expect(diagnosticCodes(source)).toContain("ASSET_LIMIT");
  });

  it("reconoce variables permitidas y rechaza expresiones desconocidas o estructurales mezcladas", () => {
    const source = [
      "# Propuesta",
      "",
      "## Contexto {#context type=CONTEXT}",
      "",
      "Hola {{client.name}} y {{proposal.options}} aquí."
    ].join("\n");
    const result = parseJanvierMarkdown(source);

    expect(result.status).toBe("ERROR");
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["UNKNOWN_VARIABLE", "INVALID_STRUCTURAL_VARIABLE_POSITION"])
    );
  });

  it("rechaza fuentes vacías, bytes binarios y límites de tamaño", () => {
    expect(diagnosticCodes("   ")).toContain("EMPTY_MARKDOWN");
    expect(diagnosticCodes(new Uint8Array([0, 1, 2]))).toEqual(
      expect.arrayContaining(["BINARY_FILE", "CONTROL_CHARACTER"])
    );
    expect(diagnosticCodes(new Uint8Array([0xff]))).toEqual(
      expect.arrayContaining(["INVALID_UTF8", "EMPTY_MARKDOWN"])
    );
    expect(diagnosticCodes("# " + "a".repeat(1024 * 1024))).toContain("FILE_TOO_LARGE");
  });

  it("genera legacy-generated.md estable para el backfill", () => {
    const source = generateLegacyMarkdownSource({
      sections: [
        {
          content: "Primer bloque.",
          id: "section-b",
          position: 2,
          title: "Alcance",
          type: "SCOPE"
        },
        {
          content: null,
          id: "section-a",
          position: 1,
          title: "Contexto\noperativo",
          type: "CONTEXT"
        }
      ],
      title: "Propuesta\noperativa"
    });

    expect(source).toBe(
      [
        "# Propuesta operativa",
        "",
        "## Contexto operativo {#legacy-section-a type=CONTEXT}",
        "",
        "## Alcance {#legacy-section-b type=SCOPE}",
        "",
        "Primer bloque.",
        ""
      ].join("\n")
    );
    expect(hashMarkdownSource(source)).toMatch(/^[a-f0-9]{64}$/);
    expect(parseJanvierMarkdown(source).status).toBe("VALID");
  });
});
