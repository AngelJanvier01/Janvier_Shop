"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./page.module.css";

type CatalogProductCardProps = {
  product: {
    brand: string | null;
    category: string;
    description: string;
    name: string;
    partNumber: string | null;
    sku: string;
    slug: string;
    specialOrder: boolean;
    upc: string | null;
    warrantyYears: number | null;
  };
  images: string[];
};

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function warrantyLabel(years: number | null) {
  if (!years) return "A CONFIRMAR";
  return `${years} ${years === 1 ? "AÑO" : "AÑOS"}`;
}

export function CatalogProductCard({ images, product }: CatalogProductCardProps) {
  const [activeImage, setActiveImage] = useState(0);
  const image = images[activeImage] ?? null;
  const href = `/suministro/catalogo/${product.slug}`;

  useEffect(() => {
    setActiveImage(0);
  }, [images]);

  function moveImage(direction: -1 | 1) {
    setActiveImage((current) => (current + direction + images.length) % images.length);
  }

  return (
    <article className={styles.productCard}>
      <div className={styles.productImage}>
        <Link aria-label={`Ver ${product.name}`} className={styles.productImageLink} href={href} prefetch={false}>
          {image ? (
            // El proveedor puede servir imágenes desde múltiples dominios configurables.
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`Imagen de ${product.name}`} decoding="async" loading="lazy" src={image} />
          ) : (
            <span>IMAGEN EN VALIDACIÓN</span>
          )}
        </Link>
        <em>{product.specialOrder ? "BAJO PEDIDO" : "FICHA TÉCNICA"}</em>
        {images.length > 1 ? (
          <div aria-label="Galería del producto" className={styles.carouselControls}>
            <button
              aria-label="Imagen anterior"
              onClick={() => moveImage(-1)}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path d="m12.5 3.5-6.5 6.5 6.5 6.5" />
              </svg>
            </button>
            <span aria-live="polite">
              {activeImage + 1} / {images.length}
            </span>
            <button aria-label="Imagen siguiente" onClick={() => moveImage(1)} type="button">
              <svg aria-hidden="true" viewBox="0 0 20 20">
                <path d="m7.5 3.5 6.5 6.5-6.5 6.5" />
              </svg>
            </button>
          </div>
        ) : null}
        <aside className={styles.productPreview}>
          <p>VISTA RÁPIDA</p>
          <dl>
            <div>
              <dt>MARCA</dt>
              <dd>{upper(product.brand ?? "A CONFIRMAR")}</dd>
            </div>
            <div>
              <dt>PARTE</dt>
              <dd>{upper(product.partNumber ?? "A CONFIRMAR")}</dd>
            </div>
            <div>
              <dt>UPC / SKU</dt>
              <dd>{upper(product.upc ?? product.sku)}</dd>
            </div>
            <div>
              <dt>GARANTÍA</dt>
              <dd>{warrantyLabel(product.warrantyYears)}</dd>
            </div>
          </dl>
        </aside>
      </div>
      <Link className={styles.productCopy} href={href} prefetch={false}>
        <span>{upper(product.category)}</span>
        <h3>{upper(product.name)}</h3>
        <p>{upper(product.description)}</p>
      </Link>
      <Link className={styles.productFooter} href={href} prefetch={false}>
        <b>{upper(product.brand ?? "JANVIER VERIFIED")}</b>
        <span>SKU {upper(product.sku)}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 19 19 5M9 5h10v10" />
        </svg>
      </Link>
    </article>
  );
}
