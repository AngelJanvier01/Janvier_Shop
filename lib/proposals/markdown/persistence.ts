import {
  markdownParseResultSchema,
  type JanvierDocument,
  type MarkdownParseResult
} from "./schemas";

export class MarkdownPersistenceError extends Error {
  readonly code = "MARKDOWN_CANNOT_PERSIST";

  constructor(message: string) {
    super(message);
    this.name = "MarkdownPersistenceError";
  }
}

/**
 * Shared persistence boundary for Hito B and later write paths. Parsing is
 * allowed to return diagnostics for an editor, but an ERROR result must never
 * become a ProposalMarkdownSource or a checkpoint.
 */
export function assertMarkdownCanPersist(result: MarkdownParseResult): JanvierDocument {
  const validated = markdownParseResultSchema.safeParse(result);
  if (!validated.success) {
    throw new MarkdownPersistenceError(
      "El AST normalizado no cumple el contrato persistible de JANVIER."
    );
  }
  if (validated.data.status === "ERROR") {
    throw new MarkdownPersistenceError(
      "Una fuente Markdown con diagnósticos ERROR no puede persistirse."
    );
  }
  return validated.data.document;
}
