import { z } from "zod";

import type {
  JanvierDocument,
  JanvierPublicDocumentAst,
  JanvierRenderableNode,
  JanvierVariableContext
} from "@/lib/proposals/markdown";
import {
  assertPublicCommercialPrivacy,
  publicProposalCommercialSchema,
  type PublicProposalCommercialDTO
} from "@/lib/proposals/commercial-dto";
import type {
  MarkdownAssetReport,
  PublicProposalAssetManifestItem
} from "@/lib/proposals/assets";

export const previewThemes = ["neutral", "night", "system"] as const;
export const previewDevices = ["desktop", "tablet", "mobile", "full-width"] as const;

export type PreviewTheme = (typeof previewThemes)[number];
export type PreviewDevice = (typeof previewDevices)[number];

export type PreviewResolvedVariables = {
  currentDate: string | null;
  missing: string[];
  values: Record<string, string | null>;
};

export type ProposalPreviewIssue = {
  actionHref: string;
  code: string;
  entity: string | null;
  message: string;
  severity: "ERROR" | "WARNING";
};

export type ProposalPreviewValidation = {
  issues: ProposalPreviewIssue[];
  status: "INCOMPLETE" | "READY_TO_SHARE" | "READY_WITH_WARNINGS";
  structuralMarkers: Record<string, number>;
};

export type ProposalPreviewModel = {
  assets: PublicProposalAssetManifestItem[];
  commercial: PublicProposalCommercialDTO;
  document: JanvierPublicDocumentAst;
  proposal: { id: string; reference: string; status: string };
  resolvedVariables: PreviewResolvedVariables;
  revision: {
    commercialVersion: number;
    id: string;
    language: string;
    markdownVersion: number;
    number: number;
    themePreference: PreviewTheme;
    title: string;
  };
  validation: ProposalPreviewValidation;
};

const simpleVariables = [
  "client.companyName",
  "client.contactName",
  "client.email",
  "proposal.reference",
  "proposal.title",
  "proposal.validUntil",
  "proposal.currency",
  "proposal.paymentTermsSummary",
  "proposal.deliveryTerms",
  "proposal.warrantySummary",
  "proposal.supportSummary",
  "author.name",
  "currentDate"
] as const;

const structuralVariables = [
  "proposal.options",
  "proposal.lineItems",
  "proposal.timeline",
  "proposal.paymentSchedule",
  "proposal.totals"
] as const;

const forbiddenPreviewFields = [
  "sourceMarkdown",
  "normalizedAst",
  "internalOnly",
  "janvier-internal",
  "internalCost",
  "markupPercent",
  "contingencyPercent",
  "supplier",
  "supplierReference",
  "internalNotes",
  "grossProfit",
  "grossMarginPercent",
  "storageKey",
  "uploadedBy",
  "token",
  "hash"
] as const;

const previewVariableSchema = z.record(z.string(), z.string().nullable());

function variableValue(name: string, context: JanvierVariableContext): string | null {
  const values: Record<string, string | null | undefined> = {
    "author.name": context.author?.name,
    "client.companyName": context.client?.companyName,
    "client.contactName": context.client?.contactName,
    "client.email": context.client?.email,
    currentDate: context.currentDate,
    "proposal.currency": context.proposal?.currency,
    "proposal.deliveryTerms": context.proposal?.deliveryTerms,
    "proposal.paymentTermsSummary": context.proposal?.paymentTermsSummary,
    "proposal.reference": context.proposal?.reference,
    "proposal.supportSummary": context.proposal?.supportSummary,
    "proposal.title": context.proposal?.title,
    "proposal.validUntil": context.proposal?.validUntil,
    "proposal.warrantySummary": context.proposal?.warrantySummary
  };
  const value = values[name];
  return typeof value === "string" && value.trim() ? value : null;
}

function collectStructuralMarkers(nodes: JanvierRenderableNode[]) {
  const counts: Record<string, number> = Object.fromEntries(
    structuralVariables.map((name) => [name, 0])
  );
  const walk = (node: JanvierRenderableNode) => {
    if (node.structural) {
      counts[node.structural] = (counts[node.structural] ?? 0) + 1;
    }
    node.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return counts;
}

function previewIssues(input: {
  assetReport: MarkdownAssetReport;
  commercial: PublicProposalCommercialDTO;
  document: JanvierDocument;
  markers: Record<string, number>;
  missingVariables: string[];
  proposalId: string;
}): ProposalPreviewIssue[] {
  const issues: ProposalPreviewIssue[] = [];
  const editor = `/admin/propuestas/${input.proposalId}`;
  if (!input.document.title) {
    issues.push({
      actionHref: `${editor}?panel=DOCUMENT`,
      code: "DOCUMENT_TITLE_MISSING",
      entity: "document",
      message: "La propuesta necesita un único H1 o título editorial.",
      severity: "ERROR"
    });
  }
  for (const section of input.document.sections) {
    if (!section.content.length && section.included && !section.internalOnly) {
      issues.push({
        actionHref: `${editor}?panel=DOCUMENT&entity=${encodeURIComponent(section.slug)}`,
        code: "PUBLIC_SECTION_EMPTY",
        entity: section.slug,
        message: `La sección pública ${section.title} no contiene contenido.`,
        severity: "WARNING"
      });
    }
  }
  for (const variable of input.missingVariables) {
    issues.push({
      actionHref: `${editor}?panel=DOCUMENT`,
      code: "VARIABLE_UNRESOLVED",
      entity: variable,
      message: `La variable ${variable} no tiene un valor dinámico disponible.`,
      severity: "WARNING"
    });
  }
  for (const marker of structuralVariables) {
    const count = input.markers[marker] ?? 0;
    if (!count) {
      issues.push({
        actionHref: `${editor}?panel=COMMERCIAL`,
        code: "STRUCTURAL_MARKER_MISSING",
        entity: marker,
        message: `${marker} no está insertado en el documento y no se duplicará.`,
        severity: "WARNING"
      });
    }
    if (count > 1) {
      issues.push({
        actionHref: `${editor}?panel=DOCUMENT`,
        code: "STRUCTURAL_MARKER_DUPLICATED",
        entity: marker,
        message: `${marker} aparece ${count} veces; el bloque se mostraría repetido.`,
        severity: "ERROR"
      });
    }
  }
  for (const alias of input.assetReport.requiredMissingAliases) {
    issues.push({
      actionHref: `${editor}?panel=ASSETS&entity=${encodeURIComponent(alias)}`,
      code: "REQUIRED_ASSET_MISSING",
      entity: alias,
      message: `Falta el activo obligatorio ${alias}.`,
      severity: "ERROR"
    });
  }
  for (const alias of input.assetReport.unresolvedAltAliases) {
    issues.push({
      actionHref: `${editor}?panel=ASSETS&entity=${encodeURIComponent(alias)}`,
      code: "ASSET_ALT_MISSING",
      entity: alias,
      message: `El activo ${alias} requiere texto alternativo.`,
      severity: "WARNING"
    });
  }
  if (!/^[A-Z]{3}$/u.test(input.commercial.currency)) {
    issues.push({
      actionHref: `${editor}?panel=COMMERCIAL`,
      code: "COMMERCIAL_CURRENCY_INVALID",
      entity: "currency",
      message: "La moneda comercial debe usar un código ISO de tres letras.",
      severity: "ERROR"
    });
  }
  if (!input.commercial.terms.validUntil) {
    issues.push({
      actionHref: `${editor}?panel=COMMERCIAL`,
      code: "COMMERCIAL_VALIDITY_MISSING",
      entity: "validUntil",
      message: "La propuesta necesita una vigencia comercial.",
      severity: "WARNING"
    });
  }
  if (!input.commercial.alternatives.length) {
    issues.push({
      actionHref: `${editor}?panel=COMMERCIAL`,
      code: "COMMERCIAL_ALTERNATIVE_MISSING",
      entity: "alternatives",
      message: "La propuesta necesita una alternativa comercial activa.",
      severity: "ERROR"
    });
  }
  if (!input.commercial.lineItems.length) {
    issues.push({
      actionHref: `${editor}?panel=COMMERCIAL`,
      code: "COMMERCIAL_LINE_ITEMS_MISSING",
      entity: "lineItems",
      message: "La alternativa seleccionada no tiene conceptos visibles.",
      severity: "ERROR"
    });
  }
  return issues;
}

export function buildProposalPreviewModel(input: {
  assetReport: MarkdownAssetReport;
  commercial: PublicProposalCommercialDTO;
  document: JanvierDocument;
  proposal: { id: string; reference: string; status: string };
  publicDocument: JanvierPublicDocumentAst;
  revision: {
    commercialVersion: number;
    id: string;
    markdownVersion: number;
    number: number;
    title: string;
  };
}): ProposalPreviewModel {
  const commercial = publicProposalCommercialSchema.parse(input.commercial);
  assertPublicCommercialPrivacy(commercial);
  const values = previewVariableSchema.parse(
    Object.fromEntries(
      simpleVariables.map((name) => [
        name,
        variableValue(name, input.publicDocument.variableContext)
      ])
    )
  );
  const declared = new Set(input.document.variables.map((variable) => variable.name));
  const missing = simpleVariables.filter(
    (name) => declared.has(name) && values[name] === null
  );
  const structuralMarkers = collectStructuralMarkers([
    ...input.publicDocument.preamble,
    ...input.publicDocument.sections.flatMap((section) => section.content)
  ]);
  const issues = previewIssues({
    assetReport: input.assetReport,
    commercial,
    document: input.document,
    markers: structuralMarkers,
    missingVariables: missing,
    proposalId: input.proposal.id
  });
  const model: ProposalPreviewModel = {
    assets: input.publicDocument.assetManifest,
    commercial,
    document: input.publicDocument,
    proposal: input.proposal,
    resolvedVariables: {
      currentDate: values.currentDate,
      missing,
      values
    },
    revision: {
      commercialVersion: input.revision.commercialVersion,
      id: input.revision.id,
      language: input.publicDocument.header.language ?? "es-MX",
      markdownVersion: input.revision.markdownVersion,
      number: input.revision.number,
      themePreference: input.publicDocument.header.theme ?? "system",
      title: input.revision.title
    },
    validation: {
      issues,
      status: issues.some((issue) => issue.severity === "ERROR")
        ? "INCOMPLETE"
        : issues.length
          ? "READY_WITH_WARNINGS"
          : "READY_TO_SHARE",
      structuralMarkers
    }
  };
  assertProposalPreviewPrivacy(model);
  return model;
}

/** Defense in depth: the model is safe because every field is allowlisted. */
export function assertProposalPreviewPrivacy(model: ProposalPreviewModel) {
  const serialized = JSON.stringify(model);
  for (const field of forbiddenPreviewFields) {
    const propertyPattern = new RegExp(`"${field}"\\s*:`, "u");
    if (propertyPattern.test(serialized)) {
      throw new Error(`El modelo de preview filtró el campo privado ${field}.`);
    }
  }
}
