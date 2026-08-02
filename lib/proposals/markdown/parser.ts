import { Buffer } from "node:buffer";

import rehypeSanitize from "rehype-sanitize";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { parseDocument } from "yaml";

import { hashMarkdownSource } from "./legacy-source";
import {
  janvierDocumentSchema,
  markdownDiagnosticSchema,
  markdownFrontMatterSchema,
  markdownParserVersion,
  markdownSectionTypeSchema,
  type JanvierDocument,
  type JanvierSection,
  type MarkdownDiagnostic,
  type MarkdownFrontMatter,
  type MarkdownParseResult,
  type MarkdownSectionType,
  type MarkdownVariable,
  type SafeMarkdownNode,
  type StoredProposalSectionType,
  storedProposalSectionTypeSchema
} from "./schemas";

export const markdownLimits = {
  maxAssets: 50,
  maxBytes: 1024 * 1024,
  maxDepth: 12,
  maxDiagnostics: 1000,
  maxLineBytes: 50 * 1024,
  maxNodes: 10000,
  maxSections: 60,
  maxVariables: 500
} as const;

type RawPosition = {
  end?: { column?: number; line?: number };
  start?: { column?: number; line?: number };
};

type RawNode = {
  attributes?: Record<string, string | null | undefined>;
  checked?: boolean | null;
  children?: RawNode[];
  depth?: number;
  lang?: string | null;
  name?: string;
  ordered?: boolean;
  position?: RawPosition;
  title?: string | null;
  type: string;
  url?: string;
  value?: string;
};

type HeadingAttributes = {
  included: boolean;
  internalOnly: boolean;
  sourceId: string;
  storageType: StoredProposalSectionType;
  title: string;
  type: MarkdownSectionType;
};

const permittedVariables = new Set([
  "client.companyName",
  "client.contactName",
  "client.email",
  "proposal.reference",
  "proposal.title",
  "proposal.validUntil",
  "proposal.currency",
  "author.name",
  "currentDate",
  "proposal.options",
  "proposal.timeline"
]);

const structuralVariables = new Set(["proposal.options", "proposal.timeline"]);
const permittedDirectiveNames = new Set([
  "janvier-callout",
  "janvier-metrics",
  "janvier-decision",
  "janvier-ascii",
  "janvier-page-break",
  "janvier-internal"
]);
const forbiddenFrontMatterKeys = new Set([
  "acceptance",
  "client",
  "currency",
  "email",
  "internalCost",
  "invite",
  "markup",
  "permission",
  "price",
  "status",
  "tax"
]);

const inferredSectionTypes: ReadonlyArray<[RegExp, MarkdownSectionType]> = [
  [/^(portada|cover)$/, "COVER"],
  [/^resumen( ejecutivo)?$/, "EXECUTIVE_SUMMARY"],
  [/^contexto/, "CONTEXT"],
  [/^problema/, "PROBLEM"],
  [/^objetivos?/, "OBJECTIVES"],
  [/^solucion/, "SOLUTION"],
  [/^alcance/, "SCOPE"],
  [/^entregables?/, "DELIVERABLES"],
  [/^arquitectura/, "ARCHITECTURE"],
  [/^alternativas?/, "ALTERNATIVES"],
  [/^(cronograma|fases|calendario)/, "TIMELINE"],
  [/^(inversion|inversiones)/, "INVESTMENT"],
  [/^(condiciones|terminos)/, "CONDITIONS"],
  [/^exclusiones?/, "EXCLUSIONS"],
  [/^(siguientes pasos|proximos pasos)/, "NEXT_STEPS"],
  [/^preguntas frecuentes|^faq$/, "FAQ"],
  [/^referencia/, "REFERENCE"]
];

function diagnostic(
  diagnostics: MarkdownDiagnostic[],
  issue: Omit<MarkdownDiagnostic, "column" | "line"> & {
    column?: number;
    line?: number;
  }
) {
  if (diagnostics.length >= markdownLimits.maxDiagnostics) {
    return;
  }
  diagnostics.push(
    markdownDiagnosticSchema.parse({
      ...issue,
      column: issue.column ?? 1,
      line: issue.line ?? 1
    })
  );
}

function location(node: RawNode) {
  return {
    column: node.position?.start?.column ?? 1,
    line: node.position?.start?.line ?? 1
  };
}

function endLine(node: RawNode) {
  return node.position?.end?.line ?? location(node).line;
}

function normalizeForLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function slugify(value: string) {
  const slug = normalizeForLookup(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "section";
}

function plainText(node: RawNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? []).map(plainText).join(node.type === "break" ? "\n" : "");
}

function restoreEscapedVariables(value: string) {
  return value.replace(/\uE000\{\{/g, "{{");
}

function protectEscapedVariables(value: string) {
  return value.replace(/\\\{\{/g, "\uE000{{");
}

function lineColumnAt(source: string, index: number) {
  const before = source.slice(0, index);
  const line = before.split(/\r\n|\r|\n/).length;
  const lastBreak = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\r"));
  return { column: index - lastBreak, line };
}

function scanVariables(source: string, diagnostics: MarkdownDiagnostic[]) {
  const variables: MarkdownVariable[] = [];
  let cursor = 0;

  while (cursor < source.length - 3) {
    const opening = source.indexOf("{{", cursor);
    if (opening < 0) {
      break;
    }
    if (opening > 0 && source[opening - 1] === "\\") {
      cursor = opening + 2;
      continue;
    }
    const closing = source.indexOf("}}", opening + 2);
    if (closing < 0) {
      diagnostic(diagnostics, {
        code: "UNTERMINATED_VARIABLE",
        ...lineColumnAt(source, opening),
        message: "La variable no tiene cierre }}.",
        severity: "ERROR",
        suggestion: "Cierra la variable o escápala con \\{{."
      });
      break;
    }

    const name = source.slice(opening + 2, closing).trim();
    const sourceLocation = lineColumnAt(source, opening);
    const structural = structuralVariables.has(name);
    if (!permittedVariables.has(name)) {
      diagnostic(diagnostics, {
        code: "UNKNOWN_VARIABLE",
        ...sourceLocation,
        message: "La variable " + name + " no está permitida.",
        severity: "ERROR",
        suggestion: "Usa una variable del catálogo JANVIER."
      });
    } else if (variables.length < markdownLimits.maxVariables) {
      variables.push({ ...sourceLocation, name, structural });
    } else {
      diagnostic(diagnostics, {
        code: "VARIABLE_LIMIT",
        ...sourceLocation,
        message: "El documento excede el límite de variables.",
        severity: "ERROR"
      });
      break;
    }
    cursor = closing + 2;
  }

  return variables;
}

function safeLink(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) {
    return "safe";
  }
  if (url.startsWith("#")) {
    return "safe";
  }
  if (/^(https:|mailto:|tel:)/iu.test(url)) {
    return "safe";
  }
  if (/^http:/iu.test(url)) {
    return "warning";
  }
  return "unsafe";
}

function parseFrontMatter(
  node: RawNode,
  diagnostics: MarkdownDiagnostic[]
): MarkdownFrontMatter | undefined {
  if (typeof node.value !== "string") {
    return undefined;
  }
  const parsed = parseDocument(node.value, {
    prettyErrors: false,
    uniqueKeys: true
  });
  const nodeLocation = location(node);

  for (const error of parsed.errors) {
    diagnostic(diagnostics, {
      code: "INVALID_FRONT_MATTER",
      ...nodeLocation,
      message: error.message,
      severity: "ERROR"
    });
  }
  if (parsed.errors.length) {
    return undefined;
  }

  let raw: unknown;
  try {
    raw = parsed.toJS({ maxAliasCount: 0 });
  } catch {
    diagnostic(diagnostics, {
      code: "INVALID_FRONT_MATTER",
      ...nodeLocation,
      message: "El front matter usa aliases YAML no permitidos.",
      severity: "ERROR"
    });
    return undefined;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    diagnostic(diagnostics, {
      code: "INVALID_FRONT_MATTER",
      ...nodeLocation,
      message: "El front matter debe ser un objeto YAML.",
      severity: "ERROR"
    });
    return undefined;
  }

  const object = raw as Record<string, unknown>;
  const allowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (forbiddenFrontMatterKeys.has(key)) {
      diagnostic(diagnostics, {
        code: "FORBIDDEN_FRONT_MATTER_KEY",
        ...nodeLocation,
        message: "La clave " + key + " no puede definir datos comerciales o permisos.",
        severity: "ERROR"
      });
      continue;
    }
    if (!Object.hasOwn(markdownFrontMatterSchema.shape, key)) {
      diagnostic(diagnostics, {
        code: "UNKNOWN_FRONT_MATTER_KEY",
        ...nodeLocation,
        message: "La clave " + key + " no pertenece al front matter JANVIER.",
        severity: "WARNING"
      });
      continue;
    }
    allowed[key] = value;
  }

  const result = markdownFrontMatterSchema.safeParse(allowed);
  if (!result.success) {
    diagnostic(diagnostics, {
      code: "INVALID_FRONT_MATTER",
      ...nodeLocation,
      message: "El front matter no cumple el esquema permitido.",
      severity: "ERROR"
    });
    return undefined;
  }
  return result.data;
}

function parseHeading(
  node: RawNode,
  diagnostics: MarkdownDiagnostic[]
): HeadingAttributes | null {
  const rawText = restoreEscapedVariables(plainText(node)).trim();
  const match = rawText.match(/\s+\{([^{}]+)\}\s*$/u);
  const attributes = {
    included: true,
    internalOnly: false,
    sourceId: "",
    type: "CUSTOM" as MarkdownSectionType
  };
  const title = (match ? rawText.slice(0, match.index) : rawText).trim();
  const nodeLocation = location(node);

  if (!title) {
    diagnostic(diagnostics, {
      code: "EMPTY_SECTION_TITLE",
      ...nodeLocation,
      message: "La sección necesita un título.",
      severity: "ERROR"
    });
    return null;
  }

  if (match) {
    for (const token of match[1].trim().split(/\s+/u)) {
      if (token.startsWith("#")) {
        if (attributes.sourceId || !/^[a-z][a-z0-9-]{0,63}$/u.test(token.slice(1))) {
          diagnostic(diagnostics, {
            code: "INVALID_SECTION_ID",
            ...nodeLocation,
            message: "El identificador de sección no es válido o está duplicado.",
            severity: "ERROR"
          });
        } else {
          attributes.sourceId = token.slice(1);
        }
        continue;
      }

      const [key, value] = token.split("=", 2);
      if (key === "type" && value) {
        const parsedType = markdownSectionTypeSchema.safeParse(value);
        if (!parsedType.success) {
          diagnostic(diagnostics, {
            code: "INVALID_SECTION_TYPE",
            ...nodeLocation,
            message: "El tipo de sección " + value + " no está permitido.",
            severity: "ERROR"
          });
        } else {
          attributes.type = parsedType.data;
        }
        continue;
      }
      if ((key === "included" || key === "internal") && value) {
        if (value !== "true" && value !== "false") {
          diagnostic(diagnostics, {
            code: "INVALID_SECTION_BOOLEAN",
            ...nodeLocation,
            message: key + " sólo acepta true o false.",
            severity: "ERROR"
          });
        } else if (key === "included") {
          attributes.included = value === "true";
        } else {
          attributes.internalOnly = value === "true";
        }
        continue;
      }
      diagnostic(diagnostics, {
        code: "UNKNOWN_SECTION_ATTRIBUTE",
        ...nodeLocation,
        message: "El atributo " + token + " no está permitido.",
        severity: "ERROR"
      });
    }
  }

  if (!attributes.sourceId) {
    attributes.sourceId = slugify(title);
    diagnostic(diagnostics, {
      code: "DERIVED_SECTION_ID",
      ...nodeLocation,
      message: "La sección usa un ID derivado del título.",
      severity: "WARNING",
      suggestion:
        "Declara {#" + attributes.sourceId + "} para conservar identidad al renombrar."
    });
  }

  if (attributes.type === "CUSTOM") {
    const normalizedTitle = normalizeForLookup(title);
    const inferred = inferredSectionTypes.find(([expression]) =>
      expression.test(normalizedTitle)
    )?.[1];
    if (inferred) {
      attributes.type = inferred;
    }
  }

  const storageType = attributes.type === "CONDITIONS" ? "TERMS" : attributes.type;
  const stored = storedProposalSectionTypeSchema.safeParse(storageType);
  if (!stored.success) {
    diagnostic(diagnostics, {
      code: "UNSUPPORTED_STORAGE_SECTION_TYPE",
      ...nodeLocation,
      message: "El tipo " + attributes.type + " no puede persistirse.",
      severity: "ERROR"
    });
    return null;
  }

  return {
    included: attributes.included,
    internalOnly: attributes.internalOnly,
    sourceId: attributes.sourceId,
    storageType: stored.data,
    title,
    type: attributes.type
  };
}

function collectNodeMetrics(node: RawNode, depth = 1): { depth: number; nodes: number } {
  return (node.children ?? []).reduce(
    (metrics, child) => {
      const nested = collectNodeMetrics(child, depth + 1);
      return {
        depth: Math.max(metrics.depth, nested.depth),
        nodes: metrics.nodes + nested.nodes
      };
    },
    { depth, nodes: 1 }
  );
}

function countNodesOfType(node: RawNode, type: string): number {
  return (
    Number(node.type === type) +
    (node.children ?? []).reduce(
      (total, child) => total + countNodesOfType(child, type),
      0
    )
  );
}

function hasNestedDirective(node: RawNode): boolean {
  return (node.children ?? []).some(
    (child) =>
      child.type === "containerDirective" ||
      child.type === "leafDirective" ||
      hasNestedDirective(child)
  );
}

function directiveHeader(children: RawNode[]) {
  const first = children[0];
  if (!first || first.type !== "paragraph") {
    return { attributes: {}, body: children };
  }
  const lines = restoreEscapedVariables(plainText(first))
    .split(/\r\n|\r|\n/u)
    .filter(Boolean);
  if (!lines.length || !lines.every((line) => /^[a-z][a-z-]*:\s*\S.*$/u.test(line))) {
    return { attributes: {}, body: children };
  }
  const attributes = Object.fromEntries(
    lines.map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator), line.slice(separator + 1).trim()];
    })
  );
  return { attributes, body: children.slice(1) };
}

function directiveNode(
  node: RawNode,
  diagnostics: MarkdownDiagnostic[],
  sectionSourceId: string | undefined
): SafeMarkdownNode | null {
  const nodeLocation = location(node);
  const name = node.name ?? "";
  if (!permittedDirectiveNames.has(name)) {
    diagnostic(diagnostics, {
      code: "UNKNOWN_DIRECTIVE",
      ...nodeLocation,
      message: "La directiva " + name + " no está permitida.",
      sectionSourceId,
      severity: "ERROR"
    });
    return null;
  }
  if (hasNestedDirective(node)) {
    diagnostic(diagnostics, {
      code: "NESTED_DIRECTIVE",
      ...nodeLocation,
      message: "Las directivas JANVIER no pueden anidarse en V1.",
      sectionSourceId,
      severity: "ERROR"
    });
  }

  const initialAttributes = Object.fromEntries(
    Object.entries(node.attributes ?? {}).map(([key, value]) => [key, value ?? ""])
  );
  // Only these directives own a key/value header. Metrics, ASCII and internal
  // content may legitimately begin with `name: value`, so treating that text
  // as attributes would silently change their meaning.
  const header =
    name === "janvier-callout" || name === "janvier-decision"
      ? directiveHeader(node.children ?? [])
      : { attributes: {}, body: node.children ?? [] };
  const attributes = { ...initialAttributes, ...header.attributes };
  const keys = Object.keys(attributes);

  if (name === "janvier-callout") {
    if (!["info", "warning", "signal"].includes(attributes.type ?? "")) {
      diagnostic(diagnostics, {
        code: "INVALID_CALLOUT",
        ...nodeLocation,
        message: "janvier-callout requiere type: info, warning o signal.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
    if (keys.some((key) => key !== "type" && key !== "title")) {
      diagnostic(diagnostics, {
        code: "INVALID_DIRECTIVE_ATTRIBUTE",
        ...nodeLocation,
        message: "janvier-callout sólo permite type y title.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
  } else if (name === "janvier-decision") {
    if (!attributes.title) {
      diagnostic(diagnostics, {
        code: "INVALID_DECISION",
        ...nodeLocation,
        message: "janvier-decision requiere title.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
    if (keys.some((key) => key !== "title")) {
      diagnostic(diagnostics, {
        code: "INVALID_DIRECTIVE_ATTRIBUTE",
        ...nodeLocation,
        message: "janvier-decision sólo permite title.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
  } else if (name === "janvier-metrics") {
    const bodyText = header.body.map(plainText).join("\n");
    const labels = bodyText.match(/(?:^|\n)\s*label:\s*\S+/gu) ?? [];
    const values = bodyText.match(/(?:^|\n)\s*value:\s*\S+/gu) ?? [];
    if (
      !labels.length ||
      labels.length !== values.length ||
      labels.length > 12 ||
      keys.length
    ) {
      diagnostic(diagnostics, {
        code: "INVALID_METRICS",
        ...nodeLocation,
        message: "janvier-metrics requiere entre 1 y 12 pares label/value.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
  } else if (name === "janvier-ascii") {
    const bodyText = header.body.map(plainText).join("\n");
    if (
      keys.length ||
      bodyText.length > 2000 ||
      /[^\x09\x0a\x0d\x20-\x7e]/u.test(bodyText)
    ) {
      diagnostic(diagnostics, {
        code: "INVALID_ASCII_DIRECTIVE",
        ...nodeLocation,
        message:
          "janvier-ascii sólo admite texto ASCII imprimible de hasta 2000 caracteres.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
  } else if (name === "janvier-page-break" || name === "janvier-internal") {
    if (keys.length) {
      diagnostic(diagnostics, {
        code: "INVALID_DIRECTIVE_ATTRIBUTE",
        ...nodeLocation,
        message: name + " no admite atributos.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
    if (name === "janvier-page-break" && header.body.length) {
      diagnostic(diagnostics, {
        code: "INVALID_PAGE_BREAK",
        ...nodeLocation,
        message: "janvier-page-break no admite contenido.",
        sectionSourceId,
        severity: "ERROR"
      });
    }
  }

  const permittedAttributes =
    name === "janvier-callout"
      ? ["type", "title"]
      : name === "janvier-decision"
        ? ["title"]
        : [];
  const safeAttributes = Object.fromEntries(
    Object.entries(attributes).filter(([key]) => permittedAttributes.includes(key))
  );

  return {
    ...(Object.keys(safeAttributes).length ? { attributes: safeAttributes } : {}),
    children: header.body
      .map((child) => toSafeNode(child, diagnostics, sectionSourceId))
      .filter((child): child is SafeMarkdownNode => Boolean(child)),
    name,
    type: "directive"
  };
}

function toSafeNode(
  node: RawNode,
  diagnostics: MarkdownDiagnostic[],
  sectionSourceId?: string
): SafeMarkdownNode | null {
  const nodeLocation = location(node);
  if (node.type === "html") {
    return null;
  }
  if (node.type === "containerDirective" || node.type === "leafDirective") {
    return directiveNode(node, diagnostics, sectionSourceId);
  }
  if (node.type === "definition") {
    return null;
  }

  const allowed = new Set([
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
    "footnoteReference"
  ]);
  if (!allowed.has(node.type)) {
    diagnostic(diagnostics, {
      code: "UNSUPPORTED_MARKDOWN_NODE",
      ...nodeLocation,
      message: "El nodo Markdown " + node.type + " no está soportado.",
      sectionSourceId,
      severity: "ERROR"
    });
    return null;
  }

  if (node.type === "link" && node.url) {
    const validity = safeLink(node.url);
    if (validity === "unsafe") {
      diagnostic(diagnostics, {
        code: "UNSAFE_LINK",
        ...nodeLocation,
        message: "El enlace " + node.url + " no usa un esquema permitido.",
        sectionSourceId,
        severity: "ERROR"
      });
      return null;
    } else if (validity === "warning") {
      diagnostic(diagnostics, {
        code: "HTTP_LINK",
        ...nodeLocation,
        message: "El enlace HTTP sólo se permite con advertencia en desarrollo.",
        sectionSourceId,
        severity: "WARNING"
      });
    }
  }
  if (
    node.type === "image" &&
    node.url &&
    !/^asset:[a-z][a-z0-9-]{0,79}$/u.test(node.url)
  ) {
    diagnostic(diagnostics, {
      code: "INVALID_ASSET_REFERENCE",
      ...nodeLocation,
      message: "Las imágenes deben usar el formato asset:alias.",
      sectionSourceId,
      severity: "ERROR"
    });
    return null;
  }

  const safeNode: SafeMarkdownNode = { type: node.type };
  if (typeof node.value === "string") {
    // Keep the author's backslash as a narrow, persisted escape marker. It
    // lets the renderer resolve a normal variable in the same text node while
    // preserving an adjacent escaped one as literal text.
    safeNode.value = node.value.replace(/\uE000\{\{/g, "\\{{");
  }
  if (typeof node.checked === "boolean" || node.checked === null) {
    safeNode.checked = node.checked;
  }
  if (typeof node.ordered === "boolean") {
    safeNode.ordered = node.ordered;
  }
  if (typeof node.url === "string") {
    safeNode.url = node.url;
  }
  if (typeof node.title === "string" || node.title === null) {
    safeNode.title = node.title;
  }
  if (typeof node.lang === "string" || node.lang === null) {
    safeNode.lang = node.lang;
  }
  if (typeof node.depth === "number") {
    safeNode.depth = node.depth;
  }
  if (node.children) {
    safeNode.children = node.children
      .map((child) => toSafeNode(child, diagnostics, sectionSourceId))
      .filter((child): child is SafeMarkdownNode => Boolean(child));
  }
  return safeNode;
}

function validateStructuralVariables(
  node: RawNode,
  diagnostics: MarkdownDiagnostic[],
  sectionSourceId?: string
) {
  if (node.type === "paragraph") {
    const text = restoreEscapedVariables(plainText(node)).trim();
    for (const variable of structuralVariables) {
      if (text.includes("{{" + variable + "}}") && text !== "{{" + variable + "}}") {
        diagnostic(diagnostics, {
          code: "INVALID_STRUCTURAL_VARIABLE_POSITION",
          ...location(node),
          message: "{{" + variable + "}} debe ocupar un párrafo completo.",
          sectionSourceId,
          severity: "ERROR"
        });
      }
    }
  }
}

function decodeSource(input: string | Uint8Array, diagnostics: MarkdownDiagnostic[]) {
  let source: string;
  if (typeof input === "string") {
    if (Buffer.byteLength(input, "utf8") > markdownLimits.maxBytes) {
      diagnostic(diagnostics, {
        code: "FILE_TOO_LARGE",
        message: "El Markdown supera el límite de 1 MiB.",
        severity: "ERROR"
      });
    }
    source = input;
  } else {
    if (input.byteLength > markdownLimits.maxBytes) {
      diagnostic(diagnostics, {
        code: "FILE_TOO_LARGE",
        message: "El Markdown supera el límite de 1 MiB.",
        severity: "ERROR"
      });
    }
    if (input.includes(0)) {
      diagnostic(diagnostics, {
        code: "BINARY_FILE",
        message: "El archivo contiene bytes nulos y no es Markdown UTF-8.",
        severity: "ERROR"
      });
    }
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      diagnostic(diagnostics, {
        code: "INVALID_UTF8",
        message: "El archivo no usa UTF-8 válido.",
        severity: "ERROR"
      });
      source = "";
    }
  }

  source = source.replace(/^\uFEFF/u, "");
  if (!source.trim()) {
    diagnostic(diagnostics, {
      code: "EMPTY_MARKDOWN",
      message: "El archivo Markdown está vacío.",
      severity: "ERROR"
    });
  }
  for (const [index, line] of source.split(/\r\n|\r|\n/u).entries()) {
    if (Buffer.byteLength(line, "utf8") > markdownLimits.maxLineBytes) {
      diagnostic(diagnostics, {
        code: "LINE_TOO_LARGE",
        column: 1,
        line: index + 1,
        message: "Una línea excede el límite permitido.",
        severity: "ERROR"
      });
      break;
    }
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(source)) {
    diagnostic(diagnostics, {
      code: "CONTROL_CHARACTER",
      message: "El Markdown contiene caracteres de control no permitidos.",
      severity: "ERROR"
    });
  }
  return source;
}

function parseTree(source: string, diagnostics: MarkdownDiagnostic[]) {
  const parser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkDirective);
  try {
    return parser.parse(protectEscapedVariables(source)) as unknown as RawNode;
  } catch (error) {
    diagnostic(diagnostics, {
      code: "MARKDOWN_PARSE_FAILED",
      message: error instanceof Error ? error.message : "No se pudo analizar Markdown.",
      severity: "ERROR"
    });
    return { children: [], type: "root" } satisfies RawNode;
  }
}

function diagnoseRawHtml(
  node: RawNode,
  diagnostics: MarkdownDiagnostic[],
  sectionSourceId?: string
) {
  if (node.type === "html") {
    diagnostic(diagnostics, {
      code: "RAW_HTML_NOT_ALLOWED",
      ...location(node),
      message: "HTML crudo no está permitido en Markdown JANVIER.",
      sectionSourceId,
      severity: "ERROR"
    });
  }
  for (const child of node.children ?? []) {
    diagnoseRawHtml(child, diagnostics, sectionSourceId);
  }
}

/**
 * The persisted value is made exclusively by toSafeNode + Zod above. This
 * conversion is a secondary compatibility/safety assertion only; its HAST is
 * deliberately never persisted or rendered directly.
 */
function assertAstCanBeSafelyRendered(tree: RawNode, diagnostics: MarkdownDiagnostic[]) {
  try {
    unified()
      .use(remarkRehype, { allowDangerousHtml: false })
      .use(rehypeSanitize)
      .runSync(tree as never);
  } catch (error) {
    diagnostic(diagnostics, {
      code: "SANITIZATION_FAILED",
      message: error instanceof Error ? error.message : "No se pudo sanitizar Markdown.",
      severity: "ERROR"
    });
  }
}

export function parseJanvierMarkdown(input: string | Uint8Array): MarkdownParseResult {
  const diagnostics: MarkdownDiagnostic[] = [];
  const source = decodeSource(input, diagnostics);
  const variables = scanVariables(source, diagnostics);
  const tree = parseTree(source, diagnostics);
  diagnoseRawHtml(tree, diagnostics);
  const metrics = collectNodeMetrics(tree);
  if (metrics.nodes > markdownLimits.maxNodes) {
    diagnostic(diagnostics, {
      code: "NODE_LIMIT",
      message: "El documento excede el límite de nodos.",
      severity: "ERROR"
    });
  }
  if (metrics.depth > markdownLimits.maxDepth) {
    diagnostic(diagnostics, {
      code: "DEPTH_LIMIT",
      message: "El documento excede la profundidad permitida.",
      severity: "ERROR"
    });
  }
  if (countNodesOfType(tree, "image") > markdownLimits.maxAssets) {
    diagnostic(diagnostics, {
      code: "ASSET_LIMIT",
      message: "El documento excede el límite de activos referenciados.",
      severity: "ERROR"
    });
  }
  assertAstCanBeSafelyRendered(tree, diagnostics);

  const sections: JanvierSection[] = [];
  const preamble: SafeMarkdownNode[] = [];
  let frontMatter: MarkdownFrontMatter | undefined;
  let title: string | null = null;
  let headingCount = 0;
  let currentSection: JanvierSection | null = null;
  const sectionIds = new Set<string>();
  const children = tree.children ?? [];

  for (const [index, child] of children.entries()) {
    if (child.type === "yaml") {
      if (index !== 0) {
        diagnostic(diagnostics, {
          code: "FRONT_MATTER_POSITION",
          ...location(child),
          message: "El front matter sólo puede aparecer al inicio.",
          severity: "ERROR"
        });
      } else {
        frontMatter = parseFrontMatter(child, diagnostics);
      }
      continue;
    }

    if (child.type === "heading" && child.depth === 1) {
      headingCount += 1;
      if (headingCount > 1) {
        diagnostic(diagnostics, {
          code: "MULTIPLE_DOCUMENT_TITLES",
          ...location(child),
          message: "Sólo se permite un encabezado # editorial.",
          severity: "ERROR"
        });
      }
      const heading = restoreEscapedVariables(plainText(child)).trim();
      if (!heading) {
        diagnostic(diagnostics, {
          code: "EMPTY_DOCUMENT_TITLE",
          ...location(child),
          message: "El título principal no puede estar vacío.",
          severity: "ERROR"
        });
      } else {
        title = heading.slice(0, 180);
      }
      continue;
    }

    if (child.type === "heading" && child.depth === 2) {
      const attributes = parseHeading(child, diagnostics);
      if (!attributes) {
        continue;
      }
      if (sectionIds.has(attributes.sourceId)) {
        diagnostic(diagnostics, {
          code: "DUPLICATE_SECTION_ID",
          ...location(child),
          message: "El ID " + attributes.sourceId + " aparece más de una vez.",
          sectionSourceId: attributes.sourceId,
          severity: "ERROR"
        });
      }
      sectionIds.add(attributes.sourceId);
      currentSection = {
        content: [],
        endLine: endLine(child),
        included: attributes.included,
        internalOnly: attributes.internalOnly,
        slug: attributes.sourceId,
        sourceId: attributes.sourceId,
        startLine: location(child).line,
        storageType: attributes.storageType,
        title: attributes.title.slice(0, 180),
        type: attributes.type
      };
      sections.push(currentSection);
      continue;
    }

    validateStructuralVariables(child, diagnostics, currentSection?.sourceId);
    const safeNode = toSafeNode(child, diagnostics, currentSection?.sourceId);
    if (!safeNode) {
      continue;
    }
    if (currentSection) {
      currentSection.content.push(safeNode);
      currentSection.endLine = Math.max(currentSection.endLine, endLine(child));
    } else {
      preamble.push(safeNode);
    }
  }

  if (!headingCount) {
    diagnostic(diagnostics, {
      code: "MISSING_DOCUMENT_TITLE",
      message: "Falta el encabezado # principal.",
      severity: "WARNING"
    });
  }
  if (sections.length > markdownLimits.maxSections) {
    diagnostic(diagnostics, {
      code: "SECTION_LIMIT",
      message: "El documento excede el límite de secciones.",
      severity: "ERROR"
    });
  }

  const document: JanvierDocument = {
    ...(frontMatter ? { frontMatter } : {}),
    preamble,
    sections,
    title,
    variables,
    version: markdownParserVersion
  };
  const validation = janvierDocumentSchema.safeParse(document);
  if (!validation.success) {
    diagnostic(diagnostics, {
      code: "NORMALIZED_AST_INVALID",
      message: "El documento normalizado no cumple el esquema JANVIER.",
      severity: "ERROR"
    });
  }

  const status = diagnostics.some((item) => item.severity === "ERROR")
    ? "ERROR"
    : diagnostics.some((item) => item.severity === "WARNING")
      ? "WARNINGS"
      : "VALID";

  return {
    diagnostics,
    document: validation.success ? validation.data : document,
    normalizedSource: source,
    parserVersion: markdownParserVersion,
    sourceHash: hashMarkdownSource(source),
    status
  };
}
