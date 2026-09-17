"use client";

import { useState } from "react";

import styles from "./product-gallery.module.css";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? null;

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
      <div className={styles.stage}>
        {/* El proveedor puede servir imágenes desde múltiples dominios configurables. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`Vista ${activeIndex + 1} de ${productName}`} src={activeImage} />
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
