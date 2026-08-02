import { hashMarkdownSource } from "./legacy-source";
import { parseJanvierMarkdown } from "./parser";
import { markdownParserVersion } from "./schemas";

type JsonRecord = Record<string, unknown>;

export type LegacyMarkdownSourceCandidate = {
  normalizedAst: unknown;
  sourceHash: string;
  sourceMarkdown: string;
};

export function isLegacyProvisionalAst(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return true;
  }
  const ast = value as JsonRecord;
  return (
    ast.version === "legacy-generated-v1" &&
    Array.isArray(ast.blocks) &&
    ast.blocks.length === 0
  );
}

export function prepareLegacyMarkdownBackfill(candidate: LegacyMarkdownSourceCandidate) {
  const result = parseJanvierMarkdown(candidate.sourceMarkdown);
  const computedSourceHash = hashMarkdownSource(candidate.sourceMarkdown);
  const hashMatches = computedSourceHash === candidate.sourceHash;

  return {
    computedSourceHash,
    hashMatches,
    update: {
      lastParsedAt: new Date(),
      normalizedAst: result.document,
      parseStatus: result.status,
      parseWarnings: result.diagnostics,
      parserVersion: markdownParserVersion
    },
    result
  };
}
