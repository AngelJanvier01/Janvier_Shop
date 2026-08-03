import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JanvierMarkdownRenderer } from "../../components/proposals/janvier-markdown-renderer";
import {
  buildAdminJanvierDocument,
  buildPublicJanvierDocument,
  JanvierDocumentRenderError,
  parseJanvierMarkdown,
  resolveJanvierText,
  type JanvierDocument
} from "../../lib/proposals/markdown";

const source = [
  "---",
  "title: Operación preparada",
  "subtitle: Documento técnico reutilizable",
  "author: Angel Janvier",
  "language: es",
  "---",
  "",
  "# Operación preparada",
  "",
  "Introducción para {{client.companyName}} y literal \\{{client.companyName}}.",
  "",
  "## Contexto {#context type=CONTEXT}",
  "",
  "Texto **fuerte**, _enfatizado_, ~~tachado~~, `inline` y [interno](/contacto).",
  "",
  "- [x] Diagnóstico documentado",
  "- [ ] Integración pendiente",
  "",
  "> Evidencia seleccionable.",
  "",
  "| Fase | Estado |",
  "| --- | --- |",
  "| Diseño | Activo |",
  "",
  '![Arquitectura](asset:architecture "Arquitectura pendiente")',
  "",
  ":::janvier-callout",
  "type: signal",
  "title: Punto de control",
  "",
  "Validar antes de ejecutar.",
  ":::",
  "",
  ":::janvier-metrics",
  "",
  "- label: Usuarios",
  "  value: 600+",
  ":::",
  "",
  ":::janvier-decision",
  "title: Aprobar alcance",
  "",
  "Confirmar ruta de implementación.",
  ":::",
  "",
  ":::janvier-ascii",
  "SYSTEM_READY = 1",
  ":::",
  "",
  ":::janvier-page-break",
  ":::",
  "",
  ":::janvier-internal",
  "Costo interno: nunca debe salir a preview.",
  ":::",
  "",
  "## Alternativas {#alternatives type=ALTERNATIVES}",
  "",
  "{{proposal.options}}",
  "",
  "## Nota interna {#internal type=REFERENCE internal=true}",
  "",
  "Proveedor privado y markup.",
  "",
  "## Excluida {#excluded type=REFERENCE included=false}",
  "",
  "Bloque removido para esta versión."
].join("\n");

function parsedDocument() {
  const result = parseJanvierMarkdown(source);
  expect(result.status).toBe("VALID");
  return result.document;
}

const context = {
  author: { name: "Angel Janvier" },
  client: {
    companyName: "Operadora Norte",
    contactName: "Mariana",
    email: "m@example.test"
  },
  currentDate: "2 de agosto de 2026",
  proposal: {
    currency: "MXN",
    reference: "JAN-01",
    title: "Operación preparada",
    validUntil: "30 de agosto de 2026"
  }
};

describe("JanvierMarkdownRenderer", () => {
  it("construye DTOs separados y no filtra contenido interno en ADMIN_PREVIEW", () => {
    const document = parsedDocument();
    const admin = buildAdminJanvierDocument(document, { variableContext: context });
    const preview = buildPublicJanvierDocument(document, { variableContext: context });
    const publicJson = JSON.stringify(preview);

    expect(admin.sections).toHaveLength(4);
    expect(admin.sections.map((section) => section.visibility)).toEqual([
      "PUBLIC",
      "PUBLIC",
      "INTERNAL",
      "EXCLUDED"
    ]);
    expect(preview.sections).toHaveLength(2);
    expect(publicJson).not.toContain("Costo interno");
    expect(publicJson).not.toContain("Proveedor privado");
    expect(publicJson).not.toContain("Bloque removido");
    expect(publicJson).not.toContain("janvier-internal");
    expect(publicJson).not.toContain("internalOnly");
    expect(publicJson).not.toContain("sourceMarkdown");
    expect(publicJson).not.toContain("internalCost");
    expect(publicJson).not.toContain("markupPercent");
    expect(publicJson).not.toContain("supplier");
    expect(publicJson).not.toContain("storageKey");
  });

  it("representa CommonMark, GFM, directivas y placeholders sin HTML crudo", () => {
    const preview = buildPublicJanvierDocument(parsedDocument(), {
      variableContext: context
    });
    const html = renderToStaticMarkup(
      createElement(JanvierMarkdownRenderer, { document: preview })
    );

    expect(html).toContain("Operadora Norte");
    expect(html).toContain("{{client.companyName}}");
    expect(html).toContain('data-testid="janvier-callout"');
    expect(html).toContain('data-testid="janvier-metrics"');
    expect(html).toContain('data-testid="janvier-decision"');
    expect(html).toContain('data-testid="janvier-ascii"');
    expect(html).toContain('data-testid="janvier-page-break"');
    expect(html).toContain('data-testid="janvier-asset-missing"');
    expect(html).toContain('data-testid="proposal-options-placeholder"');
    expect(html).toContain("<table>");
    expect(html).not.toContain("Costo interno");
    expect(html).not.toContain("<script");
  });

  it("resuelve imágenes únicamente desde el manifiesto validado", () => {
    const preview = buildPublicJanvierDocument(parsedDocument(), {
      assetManifest: [
        {
          accessUrl: "/api/proposals/assets/asset-architecture",
          alias: "architecture",
          altText: "Diagrama de arquitectura",
          height: 640,
          mimeType: "image/png",
          sha256: "a".repeat(64),
          width: 960
        }
      ],
      variableContext: context
    });
    const html = renderToStaticMarkup(
      createElement(JanvierMarkdownRenderer, { document: preview })
    );

    expect(html).toContain('data-testid="janvier-asset"');
    expect(html).toContain('src="/api/proposals/assets/asset-architecture"');
    expect(html).toContain('alt="Arquitectura"');
    expect(html).not.toContain("storageKey");
  });

  it("mantiene numeración interna diferenciada en ADMIN", () => {
    const admin = buildAdminJanvierDocument(parsedDocument(), {
      variableContext: context
    });
    const html = renderToStaticMarkup(
      createElement(JanvierMarkdownRenderer, { document: admin, label: "ADMIN_DOCUMENT" })
    );

    expect(html).toContain("INT_03");
    expect(html).toContain("EX_04");
    expect(html).toContain("JANVIER_INTERNAL");
    expect(html).toContain("Costo interno: nunca debe salir a preview.");
  });

  it("resuelve sólo variables cerradas y conserva los valores escapados", () => {
    expect(resolveJanvierText("Hola {{client.companyName}}", context)).toEqual([
      { kind: "text", value: "Hola " },
      { kind: "value", value: "Operadora Norte" }
    ]);
    expect(resolveJanvierText("{{client.companyName}}", context, true)).toEqual([
      { kind: "text", value: "{{client.companyName}}" }
    ]);
    expect(resolveJanvierText("{{client.secret}}", context)).toEqual([
      { kind: "unresolved", value: "{{client.secret}}" }
    ]);
  });

  it("bloquea un AST válido en forma pero ajeno al registro de nodos", () => {
    const document = parsedDocument();
    const injected = {
      ...document,
      preamble: [{ type: "foreignWidget" }]
    };

    expect(() => buildPublicJanvierDocument(injected)).toThrow(
      JanvierDocumentRenderError
    );
    try {
      buildPublicJanvierDocument(injected);
    } catch (error) {
      expect(error).toMatchObject({ code: "UNKNOWN_NODE" });
    }
  });

  it("procesa una fixture de 10k nodos sin depender de fuente Markdown ni HTML", () => {
    const base = parsedDocument();
    const largeDocument: JanvierDocument = {
      ...base,
      sections: [
        {
          ...base.sections[0]!,
          content: Array.from({ length: 5000 }, (_, index) => ({
            children: [{ type: "text", value: `Nodo ${index}` }],
            type: "paragraph"
          }))
        }
      ]
    };
    const startedAt = performance.now();
    const preview = buildPublicJanvierDocument(largeDocument, {
      variableContext: context
    });
    const html = renderToStaticMarkup(
      createElement(JanvierMarkdownRenderer, { document: preview })
    );
    const elapsed = performance.now() - startedAt;

    expect(html).toContain("Nodo 4999");
    expect(elapsed).toBeLessThan(5000);
  });
});
