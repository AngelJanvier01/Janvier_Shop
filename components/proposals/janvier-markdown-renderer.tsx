import Link from "next/link";
import { createElement, Fragment, type ReactNode } from "react";

import {
  resolveJanvierText,
  type JanvierRenderableNode,
  type JanvierRenderedDocument
} from "@/lib/proposals/markdown";
import {
  ProposalLineItemsTable,
  ProposalOptionsComparison,
  ProposalPaymentSchedule,
  ProposalTimeline,
  ProposalTotalsSummary
} from "@/components/proposals/proposal-commercial";

import styles from "./janvier-markdown-renderer.module.css";

type JanvierMarkdownRendererProps = {
  document: JanvierRenderedDocument;
  label?: string;
};

function nodeText(nodes: JanvierRenderableNode[] = []): string {
  return nodes
    .map((node) =>
      typeof node.value === "string" ? node.value : nodeText(node.children)
    )
    .join("");
}

function nodeLines(nodes: JanvierRenderableNode[] = []): string {
  return nodes
    .map((node) => {
      const value =
        typeof node.value === "string" ? node.value : nodeLines(node.children);
      return ["paragraph", "listItem", "tableRow"].includes(node.type)
        ? `${value}\n`
        : value;
    })
    .join("");
}

function sectionNumber(
  section: JanvierRenderedDocument["sections"][number],
  kind: JanvierRenderedDocument["kind"]
) {
  if (kind === "admin" && "visibility" in section && section.visibility === "INTERNAL") {
    return `INT_${String(section.index).padStart(2, "0")}`;
  }
  if (kind === "admin" && "visibility" in section && section.visibility === "EXCLUDED") {
    return `EX_${String(section.index).padStart(2, "0")}`;
  }
  return String(section.index).padStart(2, "0");
}

function renderText(
  value: string,
  literal: boolean | undefined,
  document: JanvierRenderedDocument
) {
  return resolveJanvierText(value, document.variableContext, literal).map(
    (part, index) =>
      part.kind === "unresolved" ? (
        <span className={styles.unresolvedVariable} key={`${part.value}-${index}`}>
          {part.value}
        </span>
      ) : (
        <Fragment key={`${part.value}-${index}`}>{part.value}</Fragment>
      )
  );
}

function renderChildren(
  nodes: JanvierRenderableNode[] | undefined,
  document: JanvierRenderedDocument
) {
  return (nodes ?? []).map((child, index) => (
    <Fragment key={`${child.type}-${child.value ?? child.name ?? index}-${index}`}>
      {renderNode(child, document)}
    </Fragment>
  ));
}

function renderLink(node: JanvierRenderableNode, document: JanvierRenderedDocument) {
  const label = renderChildren(node.children, document);
  const href = node.url ?? "#";
  if (href.startsWith("/")) {
    return <Link href={href}>{label}</Link>;
  }
  if (href.startsWith("#")) {
    return <a href={href}>{label}</a>;
  }
  const external = /^https?:/iu.test(href);
  return (
    <a
      href={href}
      {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
    >
      {label}
    </a>
  );
}

function renderMetrics(node: JanvierRenderableNode) {
  const rows = nodeLines(node.children)
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Array<{ label: string; value: string }>>((items, line) => {
      const [label, value] = line.split(/:\s*/u, 2);
      if (label === "label" && value) {
        items.push({ label: value, value: "--" });
      }
      if (label === "value" && value && items.length) {
        items[items.length - 1]!.value = value;
      }
      return items;
    }, []);
  return (
    <dl className={styles.metrics} data-testid="janvier-metrics">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderDirective(node: JanvierRenderableNode, document: JanvierRenderedDocument) {
  const children = renderChildren(node.children, document);
  switch (node.name) {
    case "janvier-callout":
      return (
        <aside
          className={styles.callout}
          data-tone={node.attributes?.type ?? "info"}
          data-testid="janvier-callout"
        >
          {node.attributes?.title ? <strong>{node.attributes.title}</strong> : null}
          <div>{children}</div>
        </aside>
      );
    case "janvier-metrics":
      return renderMetrics(node);
    case "janvier-decision":
      return (
        <aside className={styles.decision} data-testid="janvier-decision">
          <span>DECISION_REQUIRED</span>
          <h4>{node.attributes?.title ?? "Decisión requerida"}</h4>
          <div>{children}</div>
        </aside>
      );
    case "janvier-ascii":
      return (
        <pre className={styles.ascii} data-testid="janvier-ascii">
          {nodeText(node.children)}
        </pre>
      );
    case "janvier-page-break":
      return <hr className={styles.pageBreak} data-testid="janvier-page-break" />;
    case "janvier-internal":
      if (document.kind !== "admin") {
        return null;
      }
      return (
        <aside className={styles.internal} data-testid="janvier-internal">
          <span>JANVIER_INTERNAL / NO_PUBLICAR</span>
          <div>{children}</div>
        </aside>
      );
    default:
      throw new Error(`Directiva JANVIER no registrada: ${node.name ?? "sin nombre"}`);
  }
}

function renderTable(node: JanvierRenderableNode, document: JanvierRenderedDocument) {
  const rows = node.children ?? [];
  const [head, ...body] = rows;
  const renderRow = (row: JanvierRenderableNode, index: number, header = false) => (
    <tr key={`row-${index}`}>
      {(row.children ?? []).map((cell, cellIndex) => {
        const Cell = header ? "th" : "td";
        return (
          <Cell key={`cell-${cellIndex}`} scope={header ? "col" : undefined}>
            {renderChildren(cell.children, document)}
          </Cell>
        );
      })}
    </tr>
  );
  return (
    <div className={styles.tableWrap} tabIndex={0}>
      <table>
        {head ? <thead>{renderRow(head, 0, true)}</thead> : null}
        {body.length ? (
          <tbody>{body.map((row, index) => renderRow(row, index + 1))}</tbody>
        ) : null}
      </table>
    </div>
  );
}

function renderAsset(
  node: JanvierRenderableNode,
  document: JanvierRenderedDocument,
  inline = false
) {
  const alias = (node.url ?? "asset:missing").slice("asset:".length);
  const asset = document.assetManifest.find((item) => item.alias === alias);
  const retired = Boolean(asset && "removed" in asset && asset.removed);
  const altText = node.alt?.trim() || asset?.altText || "";
  if (!asset) {
    if (inline) {
      return (
        <span
          aria-label={`Activo no disponible: ${alias}`}
          className={styles.assetInlineMissing}
          role="img"
        >
          {`[ASSET_MISSING:${alias}]`}
        </span>
      );
    }
    return (
      <figure className={styles.assetPlaceholder} data-testid="janvier-asset-missing">
        <div aria-label={`Activo no disponible: ${alias}`} role="img">
          <span>ASSET_MISSING</span>
          <b>{alias}</b>
          <i>REVISION_ASSET_MANIFEST</i>
        </div>
        <figcaption>
          La referencia existe en Markdown, pero no hay un activo privado activo con este
          alias.
        </figcaption>
      </figure>
    );
  }
  const image = (
    <>
      {/* Private authenticated images cannot use the public Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={altText}
        decoding="async"
        height={asset.height ?? undefined}
        src={asset.accessUrl}
        width={asset.width ?? undefined}
      />
    </>
  );
  if (inline) {
    return <span className={styles.assetInline}>{image}</span>;
  }
  return (
    <figure
      className={styles.asset}
      data-retired={retired || undefined}
      data-testid="janvier-asset"
    >
      {image}
      <figcaption>
        <span>{retired ? "ASSET_RETIRED" : `ASSET / ${asset.alias}`}</span>
        {node.title ? <b>{node.title}</b> : null}
      </figcaption>
    </figure>
  );
}

function renderCommercialBlock(
  structural: NonNullable<JanvierRenderableNode["structural"]>,
  document: JanvierRenderedDocument
) {
  const commercial = document.commercial;
  const selectedAlternativeCode =
    document.kind === "public" ? document.selectedAlternativeCode : undefined;
  const hasCommercialData =
    commercial &&
    {
      "proposal.lineItems": commercial.lineItems.length > 0,
      "proposal.options": commercial.alternatives.length > 0,
      "proposal.paymentSchedule": commercial.paymentSchedule.length > 0,
      "proposal.timeline": commercial.timeline.length > 0,
      "proposal.totals": commercial.alternatives.length > 0
    }[structural];

  if (!commercial || !hasCommercialData) {
    const labels = {
      "proposal.lineItems": "CONCEPTOS_COMERCIALES",
      "proposal.options": "ALTERNATIVAS_COMERCIALES",
      "proposal.paymentSchedule": "ESQUEMA_DE_PAGOS",
      "proposal.timeline": "CRONOGRAMA_COMERCIAL",
      "proposal.totals": "TOTALES_COMERCIALES"
    };
    return (
      <aside
        className={styles.structuralPlaceholder}
        data-testid={`${structural.replace("proposal.", "proposal-")}-placeholder`}
      >
        <span>{labels[structural]}</span>
        <p>
          {document.mode === "ADMIN"
            ? "Sin datos comerciales para esta revisión. Completa COMMERCIAL antes de previsualizar."
            : "Este bloque comercial todavía no tiene datos disponibles."}
        </p>
      </aside>
    );
  }
  switch (structural) {
    case "proposal.options":
      return (
        <ProposalOptionsComparison
          commercial={commercial}
          selectedOptionCode={selectedAlternativeCode}
        />
      );
    case "proposal.lineItems":
      return <ProposalLineItemsTable commercial={commercial} />;
    case "proposal.timeline":
      return <ProposalTimeline commercial={commercial} />;
    case "proposal.paymentSchedule":
      return <ProposalPaymentSchedule commercial={commercial} />;
    case "proposal.totals":
      return (
        <ProposalTotalsSummary
          commercial={commercial}
          selectedOptionCode={selectedAlternativeCode}
        />
      );
  }
}

function renderNode(
  node: JanvierRenderableNode,
  document: JanvierRenderedDocument
): ReactNode {
  switch (node.type) {
    case "paragraph":
      if (node.structural) {
        return renderCommercialBlock(node.structural, document);
      }
      if (node.children?.length === 1 && node.children[0]?.type === "image") {
        return renderAsset(node.children[0], document);
      }
      return <p>{renderChildren(node.children, document)}</p>;
    case "text":
      return renderText(node.value ?? "", node.literal, document);
    case "emphasis":
      return <em>{renderChildren(node.children, document)}</em>;
    case "strong":
      return <strong>{renderChildren(node.children, document)}</strong>;
    case "delete":
      return <del>{renderChildren(node.children, document)}</del>;
    case "heading": {
      const depth = Math.min(Math.max(node.depth ?? 2, 1), 6);
      return createElement(
        `h${depth}`,
        undefined,
        renderChildren(node.children, document)
      );
    }
    case "link":
      return renderLink(node, document);
    case "blockquote":
      return <blockquote>{renderChildren(node.children, document)}</blockquote>;
    case "list": {
      const List = node.ordered ? "ol" : "ul";
      return <List>{renderChildren(node.children, document)}</List>;
    }
    case "listItem":
      return (
        <li
          className={
            node.checked === null || node.checked === undefined
              ? undefined
              : styles.taskItem
          }
        >
          {node.checked === null || node.checked === undefined ? null : (
            <span
              aria-hidden="true"
              className={styles.taskState}
              data-checked={node.checked}
            />
          )}
          {renderChildren(node.children, document)}
        </li>
      );
    case "thematicBreak":
      return <hr className={styles.rule} />;
    case "inlineCode":
      return <code>{node.value ?? ""}</code>;
    case "code":
      return (
        <pre className={styles.codeBlock}>
          <code data-language={node.lang ?? "plain"}>{node.value ?? ""}</code>
        </pre>
      );
    case "table":
      return renderTable(node, document);
    case "tableRow":
    case "tableCell":
      return renderChildren(node.children, document);
    case "image":
      return renderAsset(node, document, true);
    case "break":
      return <br />;
    case "footnoteDefinition":
      return (
        <aside className={styles.footnote}>
          {renderChildren(node.children, document)}
        </aside>
      );
    case "footnoteReference":
      return <sup className={styles.footnoteReference}>†</sup>;
    case "directive":
      return renderDirective(node, document);
    default:
      throw new Error(`Nodo JANVIER no registrado: ${node.type}`);
  }
}

export function JanvierMarkdownRenderer({
  document,
  label = "RENDERED_DOCUMENT"
}: JanvierMarkdownRendererProps) {
  const visibleSections = document.sections;
  return (
    <article
      className={styles.document}
      data-mode={document.mode}
      data-testid="janvier-markdown-renderer"
    >
      <header className={styles.documentHeader}>
        <div>
          <p>
            {label} / {document.mode}
          </p>
          <h2>{document.header.title ?? "Propuesta sin título editorial"}</h2>
          {document.header.subtitle ? (
            <p className={styles.subtitle}>{document.header.subtitle}</p>
          ) : null}
        </div>
        <dl className={styles.documentMeta}>
          {document.header.author ? (
            <div>
              <dt>AUTOR</dt>
              <dd>{document.header.author}</dd>
            </div>
          ) : null}
          {document.header.language ? (
            <div>
              <dt>IDIOMA</dt>
              <dd>{document.header.language}</dd>
            </div>
          ) : null}
          <div>
            <dt>SECCIONES</dt>
            <dd>{String(visibleSections.length).padStart(2, "0")}</dd>
          </div>
        </dl>
      </header>

      {visibleSections.length > 1 ? (
        <nav aria-label="Índice de propuesta" className={styles.index}>
          <span>ÍNDICE</span>
          <ol>
            {visibleSections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <b>{sectionNumber(section, document.kind)}</b>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {document.preamble.length ? (
        <div className={styles.preamble}>
          {renderChildren(document.preamble, document)}
        </div>
      ) : null}

      <div className={styles.sections}>
        {visibleSections.map((section) => (
          <section
            id={section.id}
            key={section.id}
            data-testid="janvier-markdown-section"
          >
            <header className={styles.sectionHeader}>
              <span>{sectionNumber(section, document.kind)}</span>
              <div>
                <p>{section.type}</p>
                <h3>{section.title}</h3>
              </div>
              {document.kind === "admin" && "sourceRange" in section ? (
                <small>
                  {section.visibility} / L{section.sourceRange.start}–L
                  {section.sourceRange.end}
                </small>
              ) : null}
            </header>
            <div className={styles.sectionContent}>
              {renderChildren(section.content, document)}
            </div>
          </section>
        ))}
      </div>

      <footer className={styles.documentFooter}>
        <span>JANVIER / DOCUMENT_SYSTEM</span>
        <span>{document.mode}</span>
      </footer>
    </article>
  );
}
