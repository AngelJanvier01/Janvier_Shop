"use client";

import { type CSSProperties, useEffect, useState } from "react";

import { getImageFrameColor } from "./image-frame-color";

import styles from "./product-gallery.module.css";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageFrameColor, setImageFrameColor] = useState<string | null>(null);
  const activeImage = images[activeIndex] ?? null;
  const imageFrameStyle = imageFrameColor
    ? ({ "--image-frame-color": imageFrameColor } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (
      images.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const cycle = window.setInterval(() => {
      setActiveIndex((current) => {
        const nextOffset = 1 + Math.floor(Math.random() * (images.length - 1));
        return (current + nextOffset) % images.length;
      });
    }, 3000);

    return () => window.clearInterval(cycle);
  }, [images.length]);

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
    <section aria-label={`Galería de ${productName}`} className={styles.gallery}>
      <div className={styles.stage} style={imageFrameStyle}>
        {/* El proveedor puede servir imágenes desde múltiples dominios configurables. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`Vista ${activeIndex + 1} de ${productName}`}
          className={styles.stageImage}
          onLoad={(event) => setImageFrameColor(getImageFrameColor(event.currentTarget))}
          src={activeImage}
        />
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
              onClick={() => setActiveIndex(index)}
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
