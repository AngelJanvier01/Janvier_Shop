"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";

import {
  analyzeMarkdownCandidate,
  autosaveMarkdownDraft,
  confirmMarkdownDraft,
  type MarkdownCandidateState,
  type MarkdownDraftSaveState
} from "@/app/(admin)/admin/propuestas/actions";

import styles from "./markdown-draft-studio.module.css";

type MarkdownDraftSource = {
  originalFileName: string | null;
  parseStatus: "PENDING_VALIDATION" | "VALID" | "WARNINGS" | "ERROR";
  sourceHash: string;
  sourceMarkdown: string;
  version: number;
};

type MarkdownDraftStudioProps = {
  initialSource: MarkdownDraftSource | null;
  revisionId: string;
};

const emptyCandidateState: MarkdownCandidateState = {};
const emptySaveState: MarkdownDraftSaveState = {};

function nodeText(node: {
  children?: Array<{ children?: unknown[]; value?: string }>;
  value?: string;
}): string {
  if (typeof node.value === "string") {
    return node.value;
  }
  return (node.children ?? [])
    .map((child) => nodeText(child as Parameters<typeof nodeText>[0]))
    .join("");
}

function statusLabel(status: "VALID" | "WARNINGS" | "ERROR") {
  return status === "VALID" ? "VALID" : status === "WARNINGS" ? "WARNINGS" : "ERROR";
}

export function MarkdownDraftStudio({
  initialSource,
  revisionId
}: MarkdownDraftStudioProps) {
  const analyzeAction = analyzeMarkdownCandidate.bind(null, revisionId);
  const confirmAction = confirmMarkdownDraft.bind(null, revisionId);
  const [analysis, analyzeFormAction, isAnalyzing] = useActionState(
    analyzeAction,
    emptyCandidateState
  );
  const [saveState, saveFormAction, isSaving] = useActionState(
    confirmAction,
    emptySaveState
  );
  const [baseline, setBaseline] = useState<MarkdownDraftSource | null>(initialSource);
  const [markdown, setMarkdown] = useState(initialSource?.sourceMarkdown ?? "");
  const [autosaveMessage, setAutosaveMessage] = useState<string | null>(null);
  const [isAutosaving, startAutosave] = useTransition();
  const [sessionRestored, setSessionRestored] = useState(false);
  const initialMarkdownRef = useRef(markdown);
  const draftKey = `janvier:markdown-draft:${revisionId}`;

  const candidate = analysis.candidate;
  const candidateIsCurrent = candidate?.sourceMarkdown === markdown;
  const hasCandidateErrors = candidate?.status === "ERROR";
  const diagnostics = candidate?.diagnostics ?? saveState.diagnostics ?? [];
  const preview = useMemo(() => candidate?.document ?? null, [candidate?.document]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.sessionStorage.getItem(draftKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { markdown?: string };
          if (
            typeof parsed.markdown === "string" &&
            parsed.markdown !== initialMarkdownRef.current
          ) {
            setMarkdown(parsed.markdown);
            setAutosaveMessage(
              "RECOVERED_SESSION_DRAFT / revisa y confirma los cambios."
            );
          }
        }
      } catch {
        // sessionStorage is merely a local recovery aid.
      } finally {
        setSessionRestored(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (!sessionRestored) {
      return;
    }
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify({ markdown }));
    } catch {
      // The editable source remains usable if browser storage is unavailable.
    }
  }, [draftKey, markdown, sessionRestored]);

  useEffect(() => {
    if (!candidate) {
      return;
    }
    const timer = window.setTimeout(() => setMarkdown(candidate.sourceMarkdown), 0);
    return () => window.clearTimeout(timer);
  }, [candidate]);

  useEffect(() => {
    if (!saveState.source) {
      return;
    }
    const timer = window.setTimeout(() => {
      setBaseline(saveState.source!);
      setMarkdown(saveState.source!.sourceMarkdown);
      setAutosaveMessage(saveState.success ?? "Borrador Markdown guardado.");
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch {
        // Recovery storage is non-essential.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, saveState.source, saveState.success]);

  useEffect(() => {
    if (!baseline || markdown === baseline.sourceMarkdown || !markdown.trim()) {
      return;
    }
    const timer = window.setTimeout(() => {
      startAutosave(async () => {
        const result = await autosaveMarkdownDraft(revisionId, {
          expectedSourceHash: baseline.sourceHash,
          expectedVersion: baseline.version,
          originalFileName: baseline.originalFileName,
          sourceMarkdown: markdown
        });
        if (result.source) {
          setBaseline(result.source);
          setMarkdown(result.source.sourceMarkdown);
          setAutosaveMessage(
            result.success ?? "Borrador Markdown guardado automáticamente."
          );
          try {
            window.sessionStorage.removeItem(draftKey);
          } catch {
            // Recovery storage is non-essential.
          }
        } else if (result.error) {
          setAutosaveMessage(`AUTOSAVE_PAUSED / ${result.error}`);
        }
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [baseline, draftKey, markdown, revisionId, startAutosave]);

  function downloadSource() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = baseline?.originalFileName ?? "janvier-propuesta.md";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.studio} data-testid="markdown-draft-studio">
      <header className={styles.header}>
        <div>
          <p>MARKDOWN_SOURCE / DRAFT_ONLY</p>
          <h2>Escribe una propuesta como documento, no como formulario infinito.</h2>
        </div>
        <div className={styles.state}>
          <span>
            {baseline
              ? `SOURCE_V${baseline.version} / ${baseline.parseStatus}`
              : "SOURCE_NOT_PERSISTED"}
          </span>
          {baseline ? (
            <button onClick={downloadSource} type="button">
              Descargar fuente
            </button>
          ) : null}
        </div>
      </header>

      <form action={analyzeFormAction} className={styles.analysisForm}>
        <label className={styles.sourceLabel}>
          <span>MARKDOWN / PASTE</span>
          <textarea
            aria-label="MARKDOWN / PASTE"
            name="markdown"
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="# Propuesta\n\n## Contexto {#context type=CONTEXT}\n\nDocumento editorial seguro."
            rows={15}
            value={markdown}
          />
        </label>
        <label className={styles.fileLabel}>
          <span>ARCHIVO MARKDOWN (.md / .markdown)</span>
          <input
            accept=".md,.markdown,text/markdown,text/x-markdown,text/plain"
            name="markdownFile"
            type="file"
          />
        </label>
        <button disabled={isAnalyzing || isSaving} type="submit">
          {isAnalyzing ? "Analizando..." : "Analizar Markdown"}
        </button>
      </form>

      {analysis.error ? <p className={styles.error}>{analysis.error}</p> : null}
      {candidate ? (
        <section className={styles.candidate} aria-live="polite">
          <div className={styles.candidateHeader}>
            <span className={candidate.status === "ERROR" ? styles.error : styles.status}>
              ANALYSIS_{statusLabel(candidate.status)}
            </span>
            <span>{candidate.document.sections.length} SECTIONS</span>
            <span>{candidate.diagnostics.length} DIAGNOSTICS</span>
          </div>
          {diagnostics.length ? (
            <ul className={styles.diagnostics} aria-label="Diagnósticos Markdown">
              {diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${diagnostic.line}-${index}`}>
                  <b>{diagnostic.severity}</b> L{diagnostic.line}:C{diagnostic.column} /
                  {diagnostic.code} — {diagnostic.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.valid}>Sin diagnósticos. La fuente puede confirmarse.</p>
          )}
          {preview ? (
            <div className={styles.preview} data-testid="markdown-text-preview">
              <p>TEXT_PREVIEW / SAFE_AST</p>
              <h3>{preview.title ?? "Propuesta sin título editorial"}</h3>
              {preview.sections.map((section) => (
                <article key={section.sourceId}>
                  <span>{section.type}</span>
                  <h4>{section.title}</h4>
                  <p>{nodeText({ children: section.content }) || "Sin texto visible."}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {candidate && candidateIsCurrent && !hasCandidateErrors ? (
        <form action={saveFormAction} className={styles.confirmForm}>
          <input name="markdown" type="hidden" value={markdown} />
          <input name="sourceHash" type="hidden" value={candidate.sourceHash} />
          <input
            name="expectedSourceHash"
            type="hidden"
            value={baseline?.sourceHash ?? ""}
          />
          <input name="expectedVersion" type="hidden" value={baseline?.version ?? ""} />
          <input
            name="originalFileName"
            type="hidden"
            value={candidate.originalFileName ?? ""}
          />
          <input name="sourceKind" type="hidden" value={candidate.sourceKind} />
          <input name="mimeType" type="hidden" value={candidate.mimeType ?? ""} />
          <input name="size" type="hidden" value={candidate.size?.toString() ?? ""} />
          <button disabled={isSaving || isAutosaving} type="submit">
            {isSaving ? "Sincronizando..." : "Confirmar y guardar Markdown"}
          </button>
          <span>La confirmación vuelve a validar el contenido en servidor.</span>
        </form>
      ) : candidate && !hasCandidateErrors ? (
        <p className={styles.muted}>
          ANALYSIS_STALE / analiza la fuente actual antes de confirmarla.
        </p>
      ) : null}

      {saveState.error ? <p className={styles.error}>{saveState.error}</p> : null}
      {autosaveMessage ? <p className={styles.autosave}>{autosaveMessage}</p> : null}
      {isAutosaving ? (
        <p className={styles.muted}>AUTOSAVE_PENDING / 1200ms debounce</p>
      ) : null}
    </section>
  );
}
