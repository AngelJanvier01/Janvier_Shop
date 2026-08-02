import { describe, expect, it } from "vitest";

import {
  hashMarkdownSource,
  isLegacyProvisionalAst,
  prepareLegacyMarkdownBackfill
} from "../../lib/proposals/markdown";

describe("backfill AST de fuentes legacy", () => {
  const safeSource =
    "# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\nContenido seguro.";

  it("detecta el AST provisional de SQL y lo reemplaza sólo tras parsear", () => {
    const prepared = prepareLegacyMarkdownBackfill({
      normalizedAst: { blocks: [], version: "legacy-generated-v1" },
      sourceHash: hashMarkdownSource(safeSource),
      sourceMarkdown: safeSource
    });

    expect(isLegacyProvisionalAst(null)).toBe(true);
    expect(isLegacyProvisionalAst({ blocks: [], version: "legacy-generated-v1" })).toBe(
      true
    );
    expect(isLegacyProvisionalAst(prepared.update.normalizedAst)).toBe(false);
    expect(prepared.hashMatches).toBe(true);
    expect(prepared.update.parseStatus).toBe("VALID");
  });

  it("clasifica HTML histórico y enlaces peligrosos como ERROR, nunca VALID", () => {
    for (const sourceMarkdown of [
      "# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\n<div>HTML legado</div>",
      "# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\n[x](javascript:alert(1))"
    ]) {
      const prepared = prepareLegacyMarkdownBackfill({
        normalizedAst: null,
        sourceHash: hashMarkdownSource(sourceMarkdown),
        sourceMarkdown
      });

      expect(prepared.hashMatches).toBe(true);
      expect(prepared.update.parseStatus).toBe("ERROR");
    }
  });

  it("detecta hashes históricos inconsistentes antes de actualizar", () => {
    const prepared = prepareLegacyMarkdownBackfill({
      normalizedAst: null,
      sourceHash: "0".repeat(64),
      sourceMarkdown: safeSource
    });

    expect(prepared.hashMatches).toBe(false);
    expect(prepared.computedSourceHash).toBe(hashMarkdownSource(safeSource));
  });
});
