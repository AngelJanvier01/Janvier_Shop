import Link from "next/link";
import { createElement, Fragment, type ReactNode } from "react";

import {
  resolveJanvierText,
  type JanvierRenderableNode,
  type JanvierRenderedDocument
} from "@/lib/proposals/markdown";

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

function renderNode(
  node: JanvierRenderableNode,
  document: JanvierRenderedDocument
): ReactNode {
  switch (node.type) {
    case "paragraph":
      if (node.structural === "proposal.options") {
        return (
          <aside
            className={styles.structuralPlaceholder}
            data-testid="proposal-options-placeholder"
          >
            <span>ALTERNATIVAS_COMERCIALES</span>
            <p>
              Se integrarán en la fase comercial; esta vista aún no calcula inversión.
            </p>
          </aside>
        );
      }
      if (node.structural === "proposal.timeline") {
        return (
          <aside
            className={styles.structuralPlaceholder}
            data-testid="proposal-timeline-placeholder"
          >
            <span>CRONOGRAMA_COMERCIAL</span>
            <p>
              Se integrará en la fase comercial; el renderer mantiene el lugar editorial.
            </p>
          </aside>
        );
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
    case "image": {
      const alias = (node.url ?? "asset:missing").slice("asset:".length);
      return (
        <figure
          className={styles.assetPlaceholder}
          data-testid="janvier-asset-placeholder"
        >
          <div aria-label={`Activo pendiente: ${alias}`} role="img">
            <span>ASSET</span>
            <b>{alias}</b>
            <i>HITO_D</i>
          </div>
          {node.title ? <figcaption>{node.title}</figcaption> : null}
        </figure>
      );
    }
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
