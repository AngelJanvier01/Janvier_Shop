import { z } from "zod";

export const markdownParserVersion = "janvier-markdown-v1";

export const markdownDiagnosticSchema = z.object({
  code: z.string().min(1).max(80),
  column: z.int().positive(),
  line: z.int().positive(),
  message: z.string().min(1).max(500),
  sectionSourceId: z.string().max(64).optional(),
  severity: z.enum(["ERROR", "WARNING", "INFO"]),
  suggestion: z.string().max(500).optional()
});

export type MarkdownDiagnostic = z.infer<typeof markdownDiagnosticSchema>;

export const markdownFrontMatterSchema = z
  .object({
    author: z.string().trim().min(1).max(120).optional(),
    language: z.string().trim().min(2).max(16).optional(),
    subtitle: z.string().trim().min(1).max(240).optional(),
    tags: z.array(z.string().trim().min(1).max(48)).max(12).optional(),
    template: z.string().trim().min(1).max(64).optional(),
    theme: z.enum(["neutral", "night"]).optional(),
    title: z.string().trim().min(1).max(180).optional()
  })
  .strict();

export type MarkdownFrontMatter = z.infer<typeof markdownFrontMatterSchema>;

export const markdownSectionTypeSchema = z.enum([
  "COVER",
  "EXECUTIVE_SUMMARY",
  "CONTEXT",
  "PROBLEM",
  "OBJECTIVES",
  "SOLUTION",
  "SCOPE",
  "DELIVERABLES",
  "ARCHITECTURE",
  "ALTERNATIVES",
  "TIMELINE",
  "INVESTMENT",
  "CONDITIONS",
  "TERMS",
  "EXCLUSIONS",
  "NEXT_STEPS",
  "FAQ",
  "CALLOUT",
  "METRICS",
  "REFERENCE",
  "CUSTOM"
]);

export type MarkdownSectionType = z.infer<typeof markdownSectionTypeSchema>;

export const storedProposalSectionTypeSchema = z.enum([
  "COVER",
  "EXECUTIVE_SUMMARY",
  "CONTEXT",
  "PROBLEM",
  "OBJECTIVES",
  "SOLUTION",
  "SCOPE",
  "DELIVERABLES",
  "ARCHITECTURE",
  "ALTERNATIVES",
  "TIMELINE",
  "INVESTMENT",
  "TERMS",
  "EXCLUSIONS",
  "NEXT_STEPS",
  "FAQ",
  "CALLOUT",
  "METRICS",
  "REFERENCE",
  "CUSTOM"
]);

export type StoredProposalSectionType = z.infer<typeof storedProposalSectionTypeSchema>;

export const markdownVariableSchema = z.object({
  column: z.int().positive(),
  line: z.int().positive(),
  name: z.string().min(1).max(64),
  structural: z.boolean()
});

export type MarkdownVariable = z.infer<typeof markdownVariableSchema>;

export type SafeMarkdownNode = {
  alt?: string | null;
  attributes?: Record<string, string>;
  checked?: boolean | null;
  children?: SafeMarkdownNode[];
  depth?: number;
  lang?: string | null;
  literal?: boolean;
  name?: string;
  ordered?: boolean;
  title?: string | null;
  type: string;
  url?: string;
  value?: string;
};

/**
 * This is the only Markdown AST shape that may be persisted or rendered.
 * It is recursive and strict on purpose: an arbitrary MDAST/HAST node or an
 * event-handler-shaped property cannot cross this boundary as JSON.
 */
export const safeMarkdownNodeSchema: z.ZodType<SafeMarkdownNode> = z.lazy(() =>
  z
    .object({
      alt: z.string().max(500).nullable().optional(),
      attributes: z.record(z.string(), z.string()).optional(),
      checked: z.boolean().nullable().optional(),
      children: z.array(safeMarkdownNodeSchema).max(10000).optional(),
      depth: z.int().min(1).max(6).optional(),
      lang: z.string().max(80).nullable().optional(),
      literal: z.boolean().optional(),
      name: z.string().max(80).optional(),
      ordered: z.boolean().optional(),
      title: z.string().max(500).nullable().optional(),
      type: z.string().min(1).max(80),
      url: z.string().max(2048).optional(),
      value: z.string().max(1000000).optional()
    })
    .strict()
);

export const janvierSectionSchema = z
  .object({
    content: z.array(safeMarkdownNodeSchema).max(10000),
    endLine: z.int().positive(),
    included: z.boolean(),
    internalOnly: z.boolean(),
    slug: z.string().min(1).max(96),
    sourceId: z.string().min(1).max(64),
    startLine: z.int().positive(),
    storageType: storedProposalSectionTypeSchema,
    title: z.string().min(1).max(180),
    type: markdownSectionTypeSchema
  })
  .strict();

export type JanvierSection = z.infer<typeof janvierSectionSchema>;

export const janvierDocumentSchema = z
  .object({
    frontMatter: markdownFrontMatterSchema.optional(),
    preamble: z.array(safeMarkdownNodeSchema).max(10000),
    sections: z.array(janvierSectionSchema).max(60),
    title: z.string().max(180).nullable(),
    variables: z.array(markdownVariableSchema).max(500),
    version: z.literal(markdownParserVersion)
  })
  .strict();

export type JanvierDocument = z.infer<typeof janvierDocumentSchema>;

export const markdownParseResultSchema = z
  .object({
    diagnostics: z.array(markdownDiagnosticSchema).max(1000),
    document: janvierDocumentSchema,
    normalizedSource: z.string().max(1000000),
    parserVersion: z.literal(markdownParserVersion),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(["VALID", "WARNINGS", "ERROR"])
  })
  .strict();

export type MarkdownParseResult = z.infer<typeof markdownParseResultSchema>;
