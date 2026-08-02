"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { JanvierDocumentRenderBoundary } from "@/components/proposals/janvier-document-render-boundary";
import { JanvierMarkdownRenderer } from "@/components/proposals/janvier-markdown-renderer";
import type {
  PreviewDevice,
  PreviewTheme,
  ProposalPreviewModel
} from "@/lib/proposals/preview";

import styles from "./proposal-preview-studio.module.css";

type RevisionChoice = { id: string; number: number; title: string };
type PreviewAuditEvent =
  | "PROPOSAL_PREVIEW_OPENED"
  | "PROPOSAL_PREVIEW_THEME_CHANGED"
  | "PROPOSAL_PREVIEW_DEVICE_CHANGED"
  | "PROPOSAL_PREVIEW_VALIDATED"
  | "PROPOSAL_PRESENTATION_MODE_OPENED";

const deviceLabels: Record<PreviewDevice, string> = {
  desktop: "DESKTOP / 1440",
  "full-width": "FULL_WIDTH",
  mobile: "MOBILE / 390",
  tablet: "TABLET / 768"
};

function resolvedTheme(theme: PreviewTheme) {
  if (theme !== "system") {
    return theme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "neutral";
}

export function ProposalPreviewStudio({
  includeOptional,
  isLocked,
  model,
  revisions,
  selectedOptionCode
}: {
  includeOptional: boolean;
  isLocked: boolean;
  model: ProposalPreviewModel;
  revisions: RevisionChoice[];
  selectedOptionCode: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [presentation, setPresentation] = useState(false);
  const [theme, setTheme] = useState<PreviewTheme>(model.revision.themePreference);
  const activeOption =
    selectedOptionCode ??
    model.commercial.alternatives.find((option) => option.recommended)?.code ??
    model.commercial.alternatives[0]?.code ??
    null;
  const currentDimensions =
    device === "mobile"
      ? "390 px"
      : device === "tablet"
        ? "768 px"
        : device === "desktop"
          ? "1440 px"
          : "100%";
  const hasOptional = model.commercial.alternatives.some(
    (option) => Number(option.optional.total) > 0
  );
  const recordAudit = useCallback(
    (event: PreviewAuditEvent) => {
      void fetch(`/api/admin/proposal-preview/${model.proposal.id}`, {
        body: JSON.stringify({ event, revisionId: model.revision.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    },
    [model.proposal.id, model.revision.id]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    recordAudit("PROPOSAL_PREVIEW_OPENED");
  }, [recordAudit]);

  useEffect(() => {
    if (presentation) {
      document.documentElement.dataset.previewPresentation = "true";
    } else {
      delete document.documentElement.dataset.previewPresentation;
    }
    return () => {
      delete document.documentElement.dataset.previewPresentation;
    };
  }, [presentation]);

  const navigate = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const readinessLabel = useMemo(
    () => model.validation.status.replaceAll("_", " "),
    [model.validation.status]
  );

  return (
    <main
      className={styles.preview}
      data-device={device}
      data-presentation={presentation || undefined}
      data-testid="proposal-preview-studio"
    >
      <header className={styles.toolbar}>
        <div>
          <p>ADMIN_PREVIEW / {model.revision.id === "" ? "" : "PUBLIC_MODEL"}</p>
          <strong>{model.proposal.reference}</strong>
          <span>{model.revision.title}</span>
        </div>
        <div className={styles.controls}>
          <Link className={styles.button} href={`/admin/propuestas/${model.proposal.id}`}>
            VOLVER AL EDITOR
          </Link>
          <label>
            Revisión
            <select
              aria-label="Seleccionar revisión"
              onChange={(event) => navigate({ revision: event.target.value })}
              value={model.revision.id}
            >
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  REV {revision.number} / {revision.title}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Tema</legend>
            {(["neutral", "night", "system"] as PreviewTheme[]).map((value) => (
              <button
                aria-pressed={theme === value}
                data-active={theme === value || undefined}
                key={value}
                onClick={() => {
                  setTheme(value);
                  recordAudit("PROPOSAL_PREVIEW_THEME_CHANGED");
                }}
                type="button"
              >
                {value.toUpperCase()}
              </button>
            ))}
          </fieldset>
          <button
            className={styles.button}
            onClick={() => router.refresh()}
            type="button"
          >
            REFRESCAR DATOS
          </button>
          <button
            className={styles.button}
            onClick={() => {
              setPresentation((current) => {
                if (!current) {
                  recordAudit("PROPOSAL_PRESENTATION_MODE_OPENED");
                }
                return !current;
              });
            }}
            type="button"
          >
            {presentation ? "SALIR PRESENTACIÓN" : "PANTALLA COMPLETA"}
          </button>
          <button className={styles.button} onClick={() => window.print()} type="button">
            IMPRIMIR BORRADOR
          </button>
          <button className={styles.share} disabled type="button">
            COMPARTIR / HITO H
          </button>
        </div>
      </header>

      <aside className={styles.notice} role="status">
        <strong>DYNAMIC_PREVIEW</strong>
        <span>Los valores de esta vista aún no están congelados.</span>
        <span>{isLocked ? "LOCKED_REVISION" : "NOT_SHARED"}</span>
      </aside>

      <section aria-label="Controles de simulación" className={styles.simulation}>
        <div>
          <p>DISPOSITIVO / {currentDimensions}</p>
          <div role="group" aria-label="Simulación de dispositivo">
            {(Object.keys(deviceLabels) as PreviewDevice[]).map((value) => (
              <button
                aria-pressed={device === value}
                data-active={device === value || undefined}
                key={value}
                onClick={() => {
                  setDevice(value);
                  recordAudit("PROPOSAL_PREVIEW_DEVICE_CHANGED");
                }}
                type="button"
              >
                {deviceLabels[value]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label>
            SIMULATED_SELECTION
            <select
              aria-label="Simular alternativa"
              onChange={(event) =>
                navigate({ option: event.target.value, optional: null })
              }
              value={activeOption ?? ""}
            >
              {model.commercial.alternatives.map((option) => (
                <option key={option.id} value={option.code}>
                  {option.code} / {option.title}
                </option>
              ))}
            </select>
          </label>
          {hasOptional ? (
            <label className={styles.optional}>
              <input
                checked={includeOptional}
                onChange={(event) =>
                  navigate({ optional: event.target.checked ? "1" : null })
                }
                type="checkbox"
              />
              PREVIEW_ONLY / incluir opcionales simulados
            </label>
          ) : null}
          <button
            className={styles.button}
            onClick={() => recordAudit("PROPOSAL_PREVIEW_VALIDATED")}
            type="button"
          >
            VALIDAR DOCUMENTO
          </button>
        </div>
      </section>

      <section className={styles.body}>
        <aside className={styles.readiness} data-status={model.validation.status}>
          <header>
            <p>DOCUMENT_READINESS</p>
            <strong>{readinessLabel}</strong>
          </header>
          {model.validation.issues.length ? (
            <ul>
              {model.validation.issues.map((issue) => (
                <li
                  data-severity={issue.severity}
                  key={`${issue.code}-${issue.entity ?? ""}`}
                >
                  <span>{issue.severity}</span>
                  <b>{issue.code}</b>
                  <p>{issue.message}</p>
                  <Link href={issue.actionHref}>IR AL EDITOR</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>El documento cumple las reglas preparatorias de esta fase.</p>
          )}
        </aside>
        <div className={styles.frame} data-device={device}>
          <div className={styles.frameMeta}>
            <span>ADMIN_PREVIEW</span>
            <span>REV {model.revision.number}</span>
            <span>{currentDimensions}</span>
          </div>
          <JanvierDocumentRenderBoundary>
            <JanvierMarkdownRenderer document={model.document} label="PROPOSAL_PREVIEW" />
          </JanvierDocumentRenderBoundary>
        </div>
      </section>
    </main>
  );
}
