import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { addProductToCart } from "@/app/suministro/commerce-actions";
import { ProductGallery } from "@/components/commerce/product-gallery";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import {
  formatMxn,
  getAccountPriceWithTax,
  getProductGallery,
  getProductImageFrameColors,
  getStockLocations
} from "@/lib/commerce/catalog";
import { createWhatsAppUrl } from "@/components/layout/navigation";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

type Specification = {
  label: string;
  value: string;
};

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const getPublishedProduct = cache(async (slug: string) =>
  database.product.findFirst({
    where: { slug, status: "PUBLISHED" }
  })
);

function extractSpecifications(value: unknown): Specification[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [{ label: "DETALLE", value: item.trim() }];
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const fieldValue = typeof record.value === "string" ? record.value.trim() : "";
    return label && fieldValue ? [{ label, value: fieldValue }] : [];
  });
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function getProductDescription(product: {
  description: string;
  partNumber: string | null;
  upc: string | null;
}) {
  const identifiers = [
    product.partNumber ? `PARTE ${product.partNumber}` : null,
    product.upc ? `UPC ${product.upc}` : null
  ].filter(Boolean);
  return upper([product.description, ...identifiers].join(" · ")).slice(0, 160);
}

export async function generateMetadata({
  params
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);

  if (!product) {
    return {
      title: "Producto no encontrado",
      robots: { follow: false, index: false }
    };
  }

  const description = getProductDescription(product);
  const images = getProductGallery(product.imageUrl, product.galleryUrls);
  const path = `/suministro/catalogo/${product.slug}`;

  return {
    title: upper(product.name),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: upper(product.name),
      description,
      images,
      type: "website",
      url: path
    }
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const [product, customer] = await Promise.all([
    getPublishedProduct(slug),
    getCurrentCustomer()
  ]);
  if (!product) {
    notFound();
  }

  const specifications = extractSpecifications(product.specifications);
  const images = getProductGallery(product.imageUrl, product.galleryUrls);
  const frameColors = getProductImageFrameColors(
    product.imageUrl,
    product.galleryUrls,
    product.imageFrameColors
  );
  const stockLocations = getStockLocations(product.stockByLocation);
  const accountPrice = customer
    ? getAccountPriceWithTax(
        product.basePriceWithTax,
        customer.account.commercialDiscountPct
      )
    : null;
  const whatsappUrl = createWhatsAppUrl(
    `Hola, me interesa ${product.name} (SKU ${product.sku}). Quisiera confirmar disponibilidad, condiciones y cotización.`
  );

  const upc = product.upc?.replace(/\D/g, "");
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: upper(product.name),
    description: getProductDescription(product),
    image: images,
    sku: product.sku,
    mpn: product.partNumber ?? undefined,
    ...(upc?.length === 13 ? { gtin13: upc } : {}),
    ...(upc?.length === 12 ? { gtin12: upc } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: upper(product.brand) } } : {}),
    category: upper(product.category),
    url: new URL(`/suministro/catalogo/${product.slug}`, siteUrl).toString()
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c")
        }}
        type="application/ld+json"
      />
      <SiteHeader />
      <main className={styles.page}>
        <Link className={styles.back} href="/suministro/catalogo">
          ← VOLVER AL CATÁLOGO
        </Link>

        <section className={styles.product}>
          <ProductGallery
            frameColors={frameColors}
            images={images}
            productName={product.name}
          />
          <div className={styles.productCopy}>
            <p>
              {upper(product.category)} / SKU {upper(product.sku)}
            </p>
            <h1>{upper(product.name)}</h1>
            <span className={styles.description}>{upper(product.description)}</span>
            <dl className={styles.identity}>
              <div>
                <dt>MARCA</dt>
                <dd>{upper(product.brand ?? "A CONFIRMAR")}</dd>
              </div>
              <div>
                <dt>NÚMERO DE PARTE</dt>
                <dd>{product.partNumber ?? "A CONFIRMAR"}</dd>
              </div>
              <div>
                <dt>UPC / SKU</dt>
                <dd>{product.upc ?? product.sku}</dd>
              </div>
              <div>
                <dt>GARANTÍA</dt>
                <dd>
                  {product.warrantyYears
                    ? `${product.warrantyYears} AÑOS`
                    : "A CONFIRMAR"}
                </dd>
              </div>
            </dl>
          </div>
          <aside className={styles.commercial}>
            <p>CONDICIÓN COMERCIAL</p>
            {customer ? (
              <>
                <strong>{formatMxn(accountPrice)}</strong>
                <span>
                  {accountPrice === null
                    ? "PRECIO SUJETO A VALIDACIÓN"
                    : "PRECIO PARA TU CUENTA / IVA INCLUIDO"}
                </span>
                <form action={addProductToCart}>
                  <input name="productId" type="hidden" value={product.id} />
                  <label>
                    <span>CANTIDAD</span>
                    <input
                      defaultValue="1"
                      max="999"
                      min="1"
                      name="quantity"
                      type="number"
                    />
                  </label>
                  <button type="submit">AGREGAR A COTIZACIÓN</button>
                </form>
                <Link href="/suministro/carrito">VER MI LISTA</Link>
              </>
            ) : (
              <>
                <strong>PRECIO POR CUENTA</strong>
                <span>
                  Ingresa con tu cuenta comercial aprobada para consultar tu condición.
                </span>
                <Link href="/suministro/acceso">INGRESAR A MI CUENTA</Link>
                <Link className={styles.secondaryAction} href="/suministro/registro">
                  SOLICITAR CUENTA
                </Link>
              </>
            )}
            <p className={styles.paymentNotice}>PAGO EN LÍNEA AÚN NO DISPONIBLE.</p>
          </aside>
        </section>

        <section className={styles.validation}>
          <div>
            <p>VALIDACIÓN HUMANA</p>
            <h2>Primero confirmamos. Luego cotizamos.</h2>
          </div>
          <div>
            <span>
              Revisamos existencia, configuración, garantía, envío y vigencia antes de
              convertir tu solicitud en una cotización formal.
            </span>
            <a href={whatsappUrl} rel="noreferrer" target="_blank">
              CONSULTAR CON UN EJECUTIVO
            </a>
          </div>
        </section>

        <section className={styles.detailGrid}>
          <section className={styles.specifications}>
            <header>
              <p>FICHA TÉCNICA</p>
              <h2>Especificaciones.</h2>
            </header>
            {specifications.length ? (
              <dl>
                {specifications.map((specification, index) => (
                  <div key={`${specification.label}-${index}`}>
                    <dt>{upper(specification.label)}</dt>
                    <dd>{upper(specification.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.pending}>FICHA EN VALIDACIÓN TÉCNICA.</p>
            )}
          </section>

          <section className={styles.stock}>
            <header>
              <p>DISPONIBILIDAD</p>
              <h2>{product.specialOrder ? "Bajo pedido." : "A validar."}</h2>
            </header>
            <div className={styles.stockTotal}>
              <span>EXISTENCIA DE REFERENCIA</span>
              <strong>{product.stockTotal ?? "—"}</strong>
              <em>
                {product.stockTotal === null
                  ? "SE CONFIRMA AL COTIZAR"
                  : "PIEZAS DETECTADAS"}
              </em>
            </div>
            {stockLocations.length ? (
              <ul>
                {stockLocations.map((location) => (
                  <li key={location.location}>
                    <span>{upper(location.location)}</span>
                    <b>{location.quantity}</b>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
