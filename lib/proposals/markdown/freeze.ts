import { createHash } from "node:crypto";
import { z } from "zod";

import { canonicalJson } from "../proposal-snapshot";
import { publicProposalCommercialSchema } from "../commercial-dto";
import type { JanvierPublicDocumentAst } from "./renderer";

const renderedNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .object({
      alt: z.string().max(500).nullable().optional(),
      attributes: z.record(z.string(), z.string()).optional(),
      checked: z.boolean().nullable().optional(),
      children: z.array(renderedNodeSchema).max(10000).optional(),
      depth: z.number().int().min(1).max(6).optional(),
      lang: z.string().max(80).nullable().optional(),
      literal: z.boolean().optional(),
      name: z.string().max(80).optional(),
      ordered: z.boolean().optional(),
      structural: z
        .enum([
          "proposal.options",
          "proposal.lineItems",
          "proposal.timeline",
          "proposal.paymentSchedule",
          "proposal.totals"
        ])
        .optional(),
      title: z.string().max(500).nullable().optional(),
      type: z.string().min(1).max(80),
      url: z.string().max(2048).optional(),
      value: z.string().max(1_000_000).optional()
    })
    .strict()
);

const frozenPublicDocumentSchema = z
  .object({
    assetManifest: z
      .array(
        z
          .object({
            accessUrl: z.string().max(2048),
            alias: z.string().max(80),
            altText: z.string().max(500),
            height: z.number().int().positive().nullable(),
            mimeType: z.string().max(128),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            width: z.number().int().positive().nullable()
          })
          .strict()
      )
      .max(50),
    commercial: publicProposalCommercialSchema.optional(),
    header: z
      .object({
        author: z.string().max(120).optional(),
        language: z.string().max(16).optional(),
        subtitle: z.string().max(240).optional(),
        tags: z.array(z.string().max(48)).max(12).optional(),
        template: z.string().max(64).optional(),
        theme: z.enum(["neutral", "night"]).optional(),
        title: z.string().max(180).nullable()
      })
      .strict(),
    kind: z.literal("public"),
    mode: z.enum(["ADMIN_PREVIEW", "CLIENT", "PRINT"]),
    preamble: z.array(renderedNodeSchema).max(10000),
    selectedAlternativeCode: z.string().max(24).optional(),
    sections: z
      .array(
        z
          .object({
            content: z.array(renderedNodeSchema).max(10000),
            id: z.string().max(96),
            index: z.number().int().positive(),
            title: z.string().max(180),
            type: z.string().max(80)
          })
          .strict()
      )
      .max(60),
    variableContext: z
      .object({
        author: z.object({ name: z.string().max(160).nullable().optional() }).optional(),
        client: z
          .object({
            companyName: z.string().max(160).nullable().optional(),
            contactName: z.string().max(160).nullable().optional(),
            email: z.string().email().max(320).nullable().optional()
          })
          .optional(),
        currentDate: z.string().max(160).nullable().optional(),
        proposal: z
          .object({
            currency: z.string().length(3).nullable().optional(),
            deliveryTerms: z.string().max(2000).nullable().optional(),
            paymentTermsSummary: z.string().max(1000).nullable().optional(),
            reference: z.string().max(80).nullable().optional(),
            supportSummary: z.string().max(2000).nullable().optional(),
            title: z.string().max(180).nullable().optional(),
            validUntil: z.string().max(160).nullable().optional(),
            warrantySummary: z.string().max(2000).nullable().optional()
          })
          .optional()
      })
      .strict()
  })
  .strict();

export type FrozenPublicProposalPackage = {
  commercial: z.infer<typeof publicProposalCommercialSchema>;
  document: JanvierPublicDocumentAst;
  publicContentHash: string;
  resolvedVariables: Record<string, unknown>;
  revision: number;
  validUntil: string | null;
  version: "markdown-first-v1";
};

export const frozenPublicProposalPackageSchema = z
  .object({
    commercial: publicProposalCommercialSchema,
    document: frozenPublicDocumentSchema,
    publicContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    resolvedVariables: z.record(z.string(), z.unknown()),
    revision: z.number().int().positive(),
    validUntil: z.string().datetime().nullable(),
    version: z.literal("markdown-first-v1")
  })
  .strict()
  .transform((value) => value as FrozenPublicProposalPackage);

export function parseFrozenPublicProposalPackage(value: unknown) {
  return frozenPublicProposalPackageSchema.safeParse(value);
}

export type FrozenProposalEvidenceInput = {
  fullAssetManifest: unknown;
  generation: { generatedAt: string; rendererVersion: string };
  normalizedAst: unknown;
  privateDocument: unknown;
  publicDocument: unknown;
  publicFacts: {
    alternative: unknown;
    commercial: unknown;
    currency: string;
    revision: number;
    validUntil: string | null;
  };
  resolvedVariables: unknown;
  sourceHash: string;
  sourceMarkdown: string;
  parserVersion: string;
};

function sha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

/**
 * The public package is exactly what a client can inspect. Private source,
 * parser metadata and internal sections are intentionally absent from its hash.
 */
export function buildFrozenProposalEvidence(input: FrozenProposalEvidenceInput) {
  const publicSnapshot = {
    alternative: input.publicFacts.alternative,
    commercial: input.publicFacts.commercial,
    currency: input.publicFacts.currency,
    document: input.publicDocument,
    resolvedVariables: input.resolvedVariables,
    revision: input.publicFacts.revision,
    validUntil: input.publicFacts.validUntil
  };
  const publicContentHash = sha256(publicSnapshot);
  const privateEvidence = {
    fullAssetManifest: input.fullAssetManifest,
    generation: input.generation,
    normalizedAst: input.normalizedAst,
    privateDocument: input.privateDocument,
    publicContentHash,
    publicSnapshot,
    sourceHash: input.sourceHash,
    sourceMarkdown: input.sourceMarkdown,
    parserVersion: input.parserVersion
  };
  return {
    evidenceHash: sha256(privateEvidence),
    privateEvidence,
    publicContentHash,
    publicSnapshot
  };
}
