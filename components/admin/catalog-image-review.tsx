"use client";

import { useId, useMemo, useRef, useState } from "react";

import styles from "./catalog-image-review.module.css";

type ProductImageAsset = {
  id: string;
  processingVersion: number;
  sourcePosition: number;
  sourceUrl: string;
  status: string;
  storageKey: string | null;
};

type ImageCandidate = ProductImageAsset & {
  label: string;
};

type CatalogImageReviewProps = {
  imageUrl: string | null;
  images: ProductImageAsset[];
  productName: string;
};

const processedStatuses = new Set(["READY", "APPROVED"]);

function previewCandidates(imageUrl: string | null, images: ProductImageAsset[]) {
  const candidates: ImageCandidate[] = [];
  const knownSources = new Set<string>();

  for (const image of images) {
    if (!image.sourceUrl || knownSources.has(image.sourceUrl)) continue;
    knownSources.add(image.sourceUrl);
    candidates.push({ ...image, label: `IMAGEN ${image.sourcePosition + 1}` });
  }

  // A manual image can exist before the processing queue has generated its first asset.
  // Keep it available to review without creating a fake derivative record.
  if (imageUrl && !knownSources.has(imageUrl)) {
    candidates.unshift({
      id: "manual-primary",
      label: "IMAGEN PRINCIPAL",
      processingVersion: 0,
      sourcePosition: 0,
      sourceUrl: imageUrl,
      status: "SIN PROCESAR",
      storageKey: null
    });
  }

  return candidates;
}

export function CatalogImageReview({
  imageUrl,
  images,
  productName
}: CatalogImageReviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const candidates = useMemo(
    () => previewCandidates(imageUrl, images),
    [imageUrl, images]
  );
  const primaryCandidate =
    candidates.find((candidate) => candidate.sourceUrl === imageUrl) ?? candidates[0];
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [view, setView] = useState<"processed" | "source">("processed");

  if (!primaryCandidate) return null;

  const activeCandidate =
    candidates.find((candidate) => candidate.id === activeCandidateId) ??
    primaryCandidate;
  const hasProcessedImage = Boolean(
    activeCandidate.storageKey && processedStatuses.has(activeCandidate.status)
  );
  const previewUrl =
    view === "processed" && hasProcessedImage
      ? `/api/product-images/${activeCandidate.id}/webp?v=${activeCandidate.processingVersion}`
      : activeCandidate.sourceUrl;

  function openPreview() {
    setActiveCandidateId(primaryCandidate.id);
    setView(
      primaryCandidate.storageKey && processedStatuses.has(primaryCandidate.status)
        ? "processed"
        : "source"
    );
    // Opening synchronously keeps the native dialog reliable when the catalog
    // is busy rendering many rows; React will update its selected image next.
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }

  function closePreview() {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
      return;
    }
  }

  function selectCandidate(candidate: ImageCandidate) {
    setActiveCandidateId(candidate.id);
    setView(
      candidate.storageKey && processedStatuses.has(candidate.status)
        ? "processed"
        : "source"
    );
  }

  return (
    <>
      <button
        className={styles.trigger}
        onClick={openPreview}
        ref={triggerRef}
        type="button"
      >
        REVISAR IMÁGENES
      </button>
      <dialog
        aria-labelledby={titleId}
        className={styles.dialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePreview();
        }}
        onClose={() => {
          triggerRef.current?.focus();
        }}
        ref={dialogRef}
      >
        <header className={styles.header}>
          <div>
            <p>CONTROL DE CALIDAD / IMÁGENES</p>
            <h2 id={titleId}>{productName}</h2>
          </div>
          <button
            aria-label="Cerrar visor de imágenes"
            onClick={closePreview}
            type="button"
          >
            CERRAR ×
          </button>
        </header>

        {candidates.length > 1 ? (
          <div
            aria-label="Elegir imagen del producto"
            className={styles.imageChoices}
            role="group"
          >
            {candidates.map((candidate) => (
              <button
                aria-pressed={candidate.id === activeCandidate.id}
                key={candidate.id}
                onClick={() => selectCandidate(candidate)}
                type="button"
              >
                {candidate.label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          aria-label="Elegir versión de imagen"
          className={styles.versionChoices}
          role="group"
        >
          <button
            aria-pressed={view === "processed"}
            disabled={!hasProcessedImage}
            onClick={() => setView("processed")}
            type="button"
          >
            PROCESADA JANVIER
          </button>
          <button
            aria-pressed={view === "source"}
            onClick={() => setView("source")}
            type="button"
          >
            ORIGINAL DEL PROVEEDOR
          </button>
        </div>

        <section aria-live="polite" className={styles.preview}>
          <div className={styles.previewMeta}>
            <span>{activeCandidate.label}</span>
            <b>
              {view === "processed" && hasProcessedImage
                ? "VERSIÓN PROCESADA"
                : "FUENTE DIRECTA"}
            </b>
          </div>
          {/* La fuente se carga sólo dentro del área administrativa para compararla. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`${
              view === "processed" && hasProcessedImage
                ? "Imagen procesada"
                : "Imagen original del proveedor"
            } de ${productName}`}
            decoding="async"
            key={previewUrl}
            referrerPolicy="no-referrer"
            src={previewUrl}
          />
        </section>
        <p className={styles.notice}>
          La fuente del proveedor sólo se consulta aquí para revisión. La ficha pública
          usa exclusivamente imágenes locales aprobadas.
        </p>
      </dialog>
    </>
  );
}
