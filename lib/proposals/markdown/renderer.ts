import {
  janvierDocumentSchema,
  type JanvierDocument,
  type SafeMarkdownNode
} from "./schemas";
import type { PublicProposalAssetManifestItem } from "../assets";
import type { PublicProposalCommercialDTO } from "../commercial-dto";

/**
 * This module is the only bridge between the persisted JANVIER AST and the
 * React renderer. Markdown source, MDAST and database records deliberately do
 * not cross this boundary.
 */
export const janvierRendererModes = [
  "ADMIN",
  "ADMIN_PREVIEW",
  "CLIENT",
  "PRINT"
] as const;

export type JanvierRendererMode = (typeof janvierRendererModes)[number];

export const janvierRendererRegistry = [
  "document",
  "section",
  "heading",
  "paragraph",
  "text",
  "strong",
  "emphasis",
  "delete",
  "link",
  "blockquote",
  "list",
  "listItem",
  "thematicBreak",
  "inlineCode",
  "code",
  "table",
  "tableHead",
  "tableBody",
  "tableRow",
  "tableCell",
  "taskItem",
  "assetPlaceholder",
  "directive",
  "break",
  "footnoteDefinition",
  "footnoteReference"
] as const;

const safeNodeTypes = new Set([
  "paragraph",
  "text",
  "emphasis",
  "strong",
  "delete",
  "heading",
  "list",
  "listItem",
  "blockquote",
  "thematicBreak",
  "code",
  "inlineCode",
  "link",
  "image",
  "break",
  "table",
  "tableRow",
  "tableCell",
  "footnoteDefinition",
  "footnoteReference",
  "directive"
] as const);

const permittedDirectives = new Set([
  "janvier-callout",
  "janvier-metrics",
  "janvier-decision",
  "janvier-ascii",
  "janvier-page-break",
  "janvier-internal"
]);

const allowedVariables = new Set([
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
  "currentDate",
  "proposal.options",
  "proposal.lineItems",
  "proposal.timeline",
  "proposal.paymentSchedule",
  "proposal.totals"
]);

const structuralVariables = new Set([
  "proposal.options",
  "proposal.lineItems",
  "proposal.timeline",
  "proposal.paymentSchedule",
  "proposal.totals"
]);

export type JanvierRenderableNode = {
  alt?: string | null;
  attributes?: Record<string, string>;
  checked?: boolean | null;
  children?: JanvierRenderableNode[];
  depth?: number;
  lang?: string | null;
  literal?: boolean;
  name?: string;
  ordered?: boolean;
  structural?:
    | "proposal.options"
    | "proposal.lineItems"
    | "proposal.timeline"
    | "proposal.paymentSchedule"
    | "proposal.totals";
  title?: string | null;
  type: string;
  url?: string;
  value?: string;
};

type JanvierDocumentHeader = {
  author?: string;
  language?: string;
  subtitle?: string;
  tags?: string[];
  template?: string;
  theme?: "neutral" | "night";
  title: string | null;
};

export type JanvierVariableContext = {
  author?: { name?: string | null };
  client?: {
    companyName?: string | null;
    contactName?: string | null;
    email?: string | null;
  };
  currentDate?: string | null;
  proposal?: {
    currency?: string | null;
    deliveryTerms?: string | null;
    paymentTermsSummary?: string | null;
    reference?: string | null;
    supportSummary?: string | null;
    title?: string | null;
    validUntil?: string | null;
    warrantySummary?: string | null;
  };
};

export type JanvierRenderedSection = {
  content: JanvierRenderableNode[];
  id: string;
  index: number;
  title: string;
  type: string;
};

export type JanvierAdminRenderedSection = JanvierRenderedSection & {
  sourceRange: { end: number; start: number };
  visibility: "EXCLUDED" | "INTERNAL" | "PUBLIC";
};

export type JanvierPublicDocumentAst = {
  assetManifest: PublicProposalAssetManifestItem[];
  commercial?: PublicProposalCommercialDTO;
  header: JanvierDocumentHeader;
  kind: "public";
  mode: "ADMIN_PREVIEW" | "CLIENT" | "PRINT";
  preamble: JanvierRenderableNode[];
  selectedAlternativeCode?: string;
  sections: JanvierRenderedSection[];
  variableContext: JanvierVariableContext;
};

export type JanvierAdminDocumentAst = {
  assetManifest: Array<PublicProposalAssetManifestItem & { removed: boolean }>;
  commercial?: PublicProposalCommercialDTO;
  header: JanvierDocumentHeader;
  kind: "admin";
  mode: "ADMIN";
  preamble: JanvierRenderableNode[];
  sections: JanvierAdminRenderedSection[];
  variableContext: JanvierVariableContext;
};

export type JanvierRenderedDocument = JanvierAdminDocumentAst | JanvierPublicDocumentAst;

export type JanvierRendererBuildOptions = {
  assetManifest?: Array<PublicProposalAssetManifestItem & { removed?: boolean }>;
  commercial?: PublicProposalCommercialDTO;
  mode?: "ADMIN_PREVIEW" | "CLIENT" | "PRINT";
  removedSectionSourceIds?: ReadonlySet<string>;
  selectedAlternativeCode?: string;
  variableContext?: JanvierVariableContext;
};

export class JanvierDocumentRenderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "JanvierDocumentRenderError";
  }
}

export type ResolvedJanvierTextPart = {
  kind: "text" | "unresolved" | "value";
  value: string;
};

function documentHeader(document: JanvierDocument): JanvierDocumentHeader {
  return {
    author: document.frontMatter?.author,
    language: document.frontMatter?.language,
    subtitle: document.frontMatter?.subtitle,
    tags: document.frontMatter?.tags,
    template: document.frontMatter?.template,
    theme: document.frontMatter?.theme,
    title: document.title ?? document.frontMatter?.title ?? null
  };
}

function validateDocument(input: unknown): JanvierDocument {
  const parsed = janvierDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new JanvierDocumentRenderError(
      "AST_SCHEMA_INVALID",
      "El documento normalizado no cumple el contrato de renderizado JANVIER."
    );
  }
  return parsed.data;
}

function isSafeHref(url: string) {
  return (
    (url.startsWith("/") && !url.startsWith("//")) ||
    url.startsWith("#") ||
    /^(https:|http:|mailto:|tel:)/iu.test(url)
  );
}

function plainText(nodes: SafeMarkdownNode[]): string {
  return nodes
    .map((node) => {
      if (typeof node.value === "string") {
        return node.value;
      }
      return node.children ? plainText(node.children) : "";
    })
    .join("");
}

function permittedAttributes(node: SafeMarkdownNode): Record<string, string> | undefined {
  if (node.type === "directive" && node.name === "janvier-callout") {
    const attributes = {
      ...(node.attributes?.type ? { type: node.attributes.type } : {}),
      ...(node.attributes?.title ? { title: node.attributes.title } : {})
    };
    return Object.keys(attributes).length ? attributes : undefined;
  }
  if (node.type === "directive" && node.name === "janvier-decision") {
    return node.attributes?.title ? { title: node.attributes.title } : undefined;
  }
  return undefined;
}

function cloneNode(
  node: SafeMarkdownNode,
  visibility: "admin" | "public"
): JanvierRenderableNode | null {
  if (!safeNodeTypes.has(node.type as never)) {
    throw new JanvierDocumentRenderError(
      "UNKNOWN_NODE",
      `El nodo ${node.type} no existe en el registro cerrado del renderer.`
    );
  }
  if (node.type === "directive") {
    if (!node.name || !permittedDirectives.has(node.name)) {
      throw new JanvierDocumentRenderError(
        "UNKNOWN_DIRECTIVE",
        `La directiva ${node.name ?? "sin nombre"} no puede renderizarse.`
      );
    }
    if (visibility === "public" && node.name === "janvier-internal") {
      return null;
    }
  }
  if (node.type === "link" && (!node.url || !isSafeHref(node.url))) {
    throw new JanvierDocumentRenderError(
      "UNSAFE_LINK",
      "Un enlace normalizado no cumple las reglas de seguridad del renderer."
    );
  }
  if (
    node.type === "image" &&
    (!node.url || !/^asset:[a-z][a-z0-9-]{0,79}$/u.test(node.url))
  ) {
    throw new JanvierDocumentRenderError(
      "INVALID_ASSET_REFERENCE",
      "Un activo normalizado no usa un alias JANVIER válido."
    );
  }

  const children = node.children
    ?.map((child) => cloneNode(child, visibility))
    .filter((child): child is JanvierRenderableNode => Boolean(child));
  const paragraphText = plainText(node.children ?? []);
  const structuralName = paragraphText.match(
    /^\{\{(proposal\.(?:options|lineItems|timeline|paymentSchedule|totals))\}\}$/u
  )?.[1];
  const structural =
    node.type === "paragraph" &&
    !node.literal &&
    structuralName &&
    structuralVariables.has(structuralName)
      ? (structuralName as JanvierRenderableNode["structural"])
      : undefined;

  return {
    ...(typeof node.alt === "string" || node.alt === null ? { alt: node.alt } : {}),
    ...(permittedAttributes(node) ? { attributes: permittedAttributes(node) } : {}),
    ...(typeof node.checked === "boolean" || node.checked === null
      ? { checked: node.checked }
      : {}),
    ...(children?.length ? { children } : {}),
    ...(typeof node.depth === "number" ? { depth: node.depth } : {}),
    ...(typeof node.lang === "string" || node.lang === null ? { lang: node.lang } : {}),
    ...(node.literal ? { literal: true } : {}),
    ...(node.name ? { name: node.name } : {}),
    ...(typeof node.ordered === "boolean" ? { ordered: node.ordered } : {}),
    ...(structural ? { structural } : {}),
    ...(typeof node.title === "string" || node.title === null
      ? { title: node.title }
      : {}),
    type: node.type,
    ...(node.url ? { url: node.url } : {}),
    ...(typeof node.value === "string" ? { value: node.value } : {})
  };
}

function cloneNodes(nodes: SafeMarkdownNode[], visibility: "admin" | "public") {
  return nodes
    .map((node) => cloneNode(node, visibility))
    .filter((node): node is JanvierRenderableNode => Boolean(node));
}

/**
 * Resolves only the closed set recognised by the parser. It never walks an
 * arbitrary object path, evaluates expressions or reaches into the database.
 */
export function resolveJanvierText(
  value: string,
  context: JanvierVariableContext,
  literal = false
): ResolvedJanvierTextPart[] {
  if (literal) {
    return [{ kind: "text", value }];
  }
  const matcher = /(?<!\\)\{\{([a-zA-Z][a-zA-Z0-9.]*)\}\}/gu;
  const parts: ResolvedJanvierTextPart[] = [];
  let cursor = 0;
  let match = matcher.exec(value);
  while (match) {
    if (match.index > cursor) {
      parts.push({
        kind: "text",
        value: value.slice(cursor, match.index).replace(/\\\{\{/gu, "{{")
      });
    }
    const name = match[1];
    const resolved = resolveVariable(name, context);
    parts.push(
      resolved === null
        ? { kind: "unresolved", value: `{{${name}}}` }
        : { kind: "value", value: resolved }
    );
    cursor = match.index + match[0].length;
    match = matcher.exec(value);
  }
  if (cursor < value.length || !parts.length) {
    parts.push({
      kind: "text",
      value: value.slice(cursor).replace(/\\\{\{/gu, "{{")
    });
  }
  return parts;
}

function resolveVariable(name: string, context: JanvierVariableContext): string | null {
  if (!allowedVariables.has(name) || structuralVariables.has(name)) {
    return null;
  }
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

export function buildAdminJanvierDocument(
  input: unknown,
  options: Pick<
    JanvierRendererBuildOptions,
    "assetManifest" | "commercial" | "removedSectionSourceIds" | "variableContext"
  > = {}
): JanvierAdminDocumentAst {
  const document = validateDocument(input);
  const removed = options.removedSectionSourceIds ?? new Set<string>();
  return {
    assetManifest: (options.assetManifest ?? []).map((item) => ({
      ...item,
      removed: Boolean(item.removed)
    })),
    ...(options.commercial ? { commercial: options.commercial } : {}),
    header: documentHeader(document),
    kind: "admin",
    mode: "ADMIN",
    preamble: cloneNodes(document.preamble, "admin"),
    sections: document.sections.map((section, index) => ({
      content: cloneNodes(section.content, "admin"),
      id: section.slug,
      index: index + 1,
      sourceRange: { end: section.endLine, start: section.startLine },
      title: section.title,
      type: section.type,
      visibility: removed.has(section.sourceId)
        ? "EXCLUDED"
        : section.internalOnly
          ? "INTERNAL"
          : section.included
            ? "PUBLIC"
            : "EXCLUDED"
    })),
    variableContext: options.variableContext ?? {}
  };
}

export function buildPublicJanvierDocument(
  input: unknown,
  options: JanvierRendererBuildOptions = {}
): JanvierPublicDocumentAst {
  const document = validateDocument(input);
  const removed = options.removedSectionSourceIds ?? new Set<string>();
  return {
    assetManifest: (options.assetManifest ?? [])
      .filter((item) => !item.removed)
      .map((item) => ({
        accessUrl: item.accessUrl,
        alias: item.alias,
        altText: item.altText,
        height: item.height,
        mimeType: item.mimeType,
        sha256: item.sha256,
        width: item.width
      })),
    ...(options.commercial ? { commercial: options.commercial } : {}),
    header: documentHeader(document),
    kind: "public",
    mode: options.mode ?? "ADMIN_PREVIEW",
    preamble: cloneNodes(document.preamble, "public"),
    sections: document.sections
      .filter(
        (section) =>
          section.included && !section.internalOnly && !removed.has(section.sourceId)
      )
      .map((section, index) => ({
        content: cloneNodes(section.content, "public"),
        id: section.slug,
        index: index + 1,
        title: section.title,
        type: section.type
      })),
    ...(options.selectedAlternativeCode
      ? { selectedAlternativeCode: options.selectedAlternativeCode }
      : {}),
    variableContext: options.variableContext ?? {}
  };
}
