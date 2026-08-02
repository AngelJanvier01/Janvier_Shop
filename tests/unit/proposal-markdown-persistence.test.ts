import { describe, expect, it } from "vitest";

import {
  assertMarkdownCanPersist,
  MarkdownPersistenceError,
  parseJanvierMarkdown
} from "../../lib/proposals/markdown";

describe("frontera persistible de Markdown", () => {
  it("acepta exclusivamente un AST JANVIER sin errores", () => {
    const result = parseJanvierMarkdown(
      "# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\nContenido seguro."
    );

    expect(assertMarkdownCanPersist(result).sections).toHaveLength(1);
  });

  it("no deja persistir un resultado con HTML, URL insegura o nodos ajenos", () => {
    const unsafe = parseJanvierMarkdown(
      "# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))"
    );
    const injected = {
      ...parseJanvierMarkdown("# Propuesta"),
      document: {
        ...parseJanvierMarkdown("# Propuesta").document,
        preamble: [{ onClick: "alert(1)", type: "paragraph" }]
      }
    } as never;

    expect(() => assertMarkdownCanPersist(unsafe)).toThrow(MarkdownPersistenceError);
    expect(() => assertMarkdownCanPersist(injected)).toThrow(MarkdownPersistenceError);
  });
});
