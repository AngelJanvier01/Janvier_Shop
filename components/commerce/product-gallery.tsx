"use client";

import { useRef, useState } from "react";

import { sendProductEngagement } from "@/components/analytics/product-engagement-client";
import { useAutoAdvance } from "./use-auto-advance";

import styles from "./product-gallery.module.css";

type ProductGalleryProps = {
  frameColors: string[];
  images: string[];
  productId?: string;
  productName: string;
};

export function ProductGallery({
  frameColors,
  images,
  productId,
  productName
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const manuallySeen = useRef(new Set<number>([0]));
  const completedReported = useRef(false);
  const activeImage = images[activeIndex] ?? null;

  function selectImage(index: number) {
    setActiveIndex(index);
    manuallySeen.current.add(index);
    if (
      productId &&
      !completedReported.current &&
      images.length > 1 &&
      manuallySeen.current.size === images.length
    ) {
      completedReported.current = true;
      sendProductEngagement({
        eventType: "GALLERY_COMPLETED",
        galleryImageCount: images.length,
        productId
      });
    }
  }

  const { containerRef, setInteractionPaused } = useAutoAdvance(images.length > 1, () => {
    setActiveIndex((current) => {
      const nextOffset = 1 + Math.floor(Math.random() * (images.length - 1));
      return (current + nextOffset) % images.length;
    });
  });

  if (!activeImage) {
    return (
      <div className={styles.empty}>
        <span>IMAGEN EN VALIDACIÓN</span>
        <p>
          La ficha técnica ya está disponible. La galería se completa desde el proveedor.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={`Galería de ${productName}`}
      className={styles.gallery}
      data-image-count={images.length}
      data-single-image={images.length === 1}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setInteractionPaused(false);
        }
      }}
      onFocus={() => setInteractionPaused(true)}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      ref={containerRef}
    >
      <div className={styles.stage} style={{ backgroundColor: frameColors[activeIndex] }}>
        <div className={styles.imageFrame}>
          {/* El proveedor puede servir imágenes desde múltiples dominios configurables. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`Vista ${activeIndex + 1} de ${productName}`}
            className={styles.stageImage}
            src={activeImage}
          />
        </div>
        <span>
          {activeIndex + 1} / {images.length}
        </span>
      </div>
      {images.length > 1 ? (
        <div aria-label="Seleccionar imagen" className={styles.thumbnails} role="list">
          {images.map((image, index) => (
            <button
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={`Mostrar imagen ${index + 1}`}
              className={index === activeIndex ? styles.active : undefined}
              key={image}
              onClick={() => selectImage(index)}
              role="listitem"
              type="button"
            >
              {/* El proveedor puede servir imágenes desde múltiples dominios configurables. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" src={image} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
