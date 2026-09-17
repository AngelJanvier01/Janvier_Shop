"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCatalogCardCopy } from "@/lib/commerce/catalog-card-copy";

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
  frameColors: string[];
  images: string[];
};

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function warrantyLabel(years: number | null) {
  if (!years) return "A CONFIRMAR";
  return `${years} ${years === 1 ? "AÑO" : "AÑOS"}`;
}

export function CatalogProductCard({
  frameColors,
  images,
  product
}: CatalogProductCardProps) {
  const [activeImage, setActiveImage] = useState(0);
  const image = images[activeImage] ?? null;
  const href = `/suministro/catalogo/${product.slug}`;
  const cardCopy = getCatalogCardCopy(product.name, product.description);

  useEffect(() => {
    if (
      images.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const cycle = window.setInterval(() => {
      setActiveImage((current) => {
        const nextOffset = 1 + Math.floor(Math.random() * (images.length - 1));
        return (current + nextOffset) % images.length;
      });
    }, 3000);

    return () => window.clearInterval(cycle);
  }, [images.length]);

  return (
    <article className={styles.productCard}>
      <div
        className={styles.productImage}
        style={{ backgroundColor: frameColors[activeImage] }}
      >
        <Link
          aria-label={`Ver ${product.name}`}
          className={styles.productImageLink}
          href={href}
          prefetch={false}
        >
          {image ? (
            // El proveedor puede servir imágenes desde múltiples dominios configurables.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Imagen de ${product.name}`}
              decoding="async"
              loading="lazy"
              src={image}
            />
          ) : (
            <span>IMAGEN EN VALIDACIÓN</span>
          )}
        </Link>
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
        <h3>{upper(cardCopy.heading)}</h3>
        {cardCopy.continuation ? <p>{upper(cardCopy.continuation)}</p> : null}
      </Link>
      <Link className={styles.productFooter} href={href} prefetch={false}>
        <span>VER FICHA TÉCNICA</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 19 19 5M9 5h10v10" />
        </svg>
      </Link>
    </article>
  );
}
