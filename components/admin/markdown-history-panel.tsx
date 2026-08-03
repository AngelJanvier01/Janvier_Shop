"use client";

import { useActionState, useState, useTransition } from "react";

import {
  applyMarkdownTemplate,
  getMarkdownCheckpointDiff,
  restoreMarkdownCheckpoint,
  type MarkdownCheckpointDiffState,
  type MarkdownHistoryMutationState
} from "@/app/(admin)/admin/propuestas/actions";
import { markdownTemplates } from "@/lib/proposals/markdown/templates-client";

import styles from "./markdown-history-panel.module.css";

type Checkpoint = {
  createdAt: string;
  id: string;
  reason: string;
  sequence: number;
  sourceHash: string;
};

type MarkdownHistoryPanelProps = {
  checkpoints: Checkpoint[];
  revisionId: string;
};

const initialMutationState: MarkdownHistoryMutationState = {};

function checkpointDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

export function MarkdownHistoryPanel({
  checkpoints,
  revisionId
}: MarkdownHistoryPanelProps) {
  const restoreAction = restoreMarkdownCheckpoint.bind(null, revisionId);
  const templateAction = applyMarkdownTemplate.bind(null, revisionId);
  const [restoreState, restoreFormAction, restoring] = useActionState(
    restoreAction,
    initialMutationState
  );
  const [templateState, templateFormAction, applyingTemplate] = useActionState(
    templateAction,
    initialMutationState
  );
  const [diff, setDiff] = useState<MarkdownCheckpointDiffState | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [isLoadingDiff, startDiffTransition] = useTransition();

  function loadDiff(checkpointId: string) {
    setDiffError(null);
    startDiffTransition(async () => {
      try {
        setDiff(await getMarkdownCheckpointDiff(revisionId, checkpointId));
      } catch (error) {
        setDiff(null);
        setDiffError(
          error instanceof Error ? error.message : "No se pudo generar el diff."
        );
      }
    });
  }

  return (
    <section className={styles.panel} data-testid="markdown-history-panel">
      <header className={styles.header}>
        <div>
          <p>HISTORY / CHECKPOINTS</p>
          <h2>Cada cambio importante queda recuperable, sin sobrescribir evidencia.</h2>
        </div>
        <span>{checkpoints.length} REGISTROS</span>
      </header>

      <div className={styles.templates}>
        <div>
          <p>PLANTILLAS / CONTROLLED_SOURCE</p>
          <span>Crean un checkpoint nuevo; no modifican ninguna revisión bloqueada.</span>
        </div>
        <form action={templateFormAction}>
          <select
            aria-label="Plantilla Markdown"
            defaultValue=""
            name="templateId"
            required
          >
            <option disabled value="">
              Seleccionar plantilla
            </option>
            {markdownTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
          <button disabled={applyingTemplate} type="submit">
            {applyingTemplate ? "Aplicando..." : "Aplicar plantilla"}
          </button>
        </form>
        {templateState.error ? (
          <p className={styles.error}>{templateState.error}</p>
        ) : null}
        {templateState.success ? (
          <p className={styles.success}>{templateState.success}</p>
        ) : null}
      </div>

      {checkpoints.length ? (
        <div className={styles.historyGrid}>
          <ol className={styles.entries} aria-label="Historial de checkpoints">
            {checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <div>
                  <b>{checkpoint.reason}</b>
                  <span>
                    V{checkpoint.sequence} / {checkpoint.sourceHash.slice(0, 10)} /{" "}
                    {checkpointDate(checkpoint.createdAt)}
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    disabled={isLoadingDiff}
                    onClick={() => loadDiff(checkpoint.id)}
                    type="button"
                  >
                    Comparar
                  </button>
                  <form action={restoreFormAction}>
                    <input name="checkpointId" type="hidden" value={checkpoint.id} />
                    <button disabled={restoring} type="submit">
                      Restaurar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
          <section className={styles.diff} aria-live="polite">
            <p>DIFF / CHECKPOINT → CURRENT</p>
            {isLoadingDiff ? <span>Calculando diferencias…</span> : null}
            {diffError ? <span className={styles.error}>{diffError}</span> : null}
            {diff ? (
              <pre>
                {diff.diff.map((line, index) => (
                  <code
                    className={styles[`line${line.kind}`]}
                    key={`${line.kind}-${index}`}
                  >
                    {line.kind === "ADDED" ? "+" : line.kind === "REMOVED" ? "−" : " "}{" "}
                    {line.value || " "}
                    {"\n"}
                  </code>
                ))}
              </pre>
            ) : (
              <span>
                Selecciona un checkpoint para comparar su fuente con el documento actual.
              </span>
            )}
          </section>
        </div>
      ) : (
        <p className={styles.empty}>
          Aún no hay fuente Markdown persistida para esta revisión.
        </p>
      )}
      {restoreState.error ? <p className={styles.error}>{restoreState.error}</p> : null}
      {restoreState.success ? (
        <p className={styles.success}>{restoreState.success}</p>
      ) : null}
    </section>
  );
}
