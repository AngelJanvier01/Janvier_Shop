import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { addProductToCart } from "@/app/suministro/commerce-actions";
import { ProductEngagementTracker } from "@/components/analytics/product-engagement-tracker";
import { ProductGallery } from "@/components/commerce/product-gallery";
import { ProductInformationActions } from "@/components/commerce/product-information-actions";
import { SupplySubheader } from "@/components/commerce/supply-subheader";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import {
  formatMxn,
  getAccountPriceWithTax,
  getProductGallery,
  getProductImageFrameColors
} from "@/lib/commerce/catalog";
import { extractProductSpecifications } from "@/lib/commerce/product-specifications";
import { database } from "@/lib/database";
import { isDeliveryQueueReady } from "@/lib/notifications/delivery-provider";

import styles from "./page.module.css";

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

const getPublishedProduct = cache(async (slug: string) =>
  database.product.findFirst({
    select: {
      basePriceWithTax: true,
      brand: true,
      category: true,
      description: true,
      galleryUrls: true,
      id: true,
      imageFrameColors: true,
      imageUrl: true,
      imageDerivatives: {
        orderBy: { sourcePosition: "asc" },
        select: { id: true, processingVersion: true, sourceUrl: true, status: true },
        where: {
          OR: [
            { status: "APPROVED" },
            {
              reviewedAt: { not: null },
              status: { in: ["PENDING", "PROCESSING", "RETRY"] }
            }
          ],
          storageKey: { not: null }
        }
      },
      name: true,
      partNumber: true,
      sku: true,
      slug: true,
      specialOrder: true,
      specifications: true,
      stockTotal: true,
      upc: true,
      warrantyYears: true
    },
    where: { slug, status: "PUBLISHED" }
  })
);

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

function availabilityCopy(product: { specialOrder: boolean; stockTotal: number | null }) {
  if (product.stockTotal !== null) {
    return {
      label: product.stockTotal > 0 ? "CON EXISTENCIAS" : "SIN EXISTENCIAS",
      value: String(product.stockTotal)
    };
  }
  if (product.specialOrder) {
    return {
      label: "BAJO PEDIDO",
      value: "BAJO PEDIDO"
    };
  }
  return {
    label: "CONSULTAR DISPONIBILIDAD",
    value: "A CONFIRMAR"
  };
}

export async function generateMetadata({
  params
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) {
    return { title: "Producto no encontrado", robots: { follow: false, index: false } };
  }

  const description = getProductDescription(product);
  const images = getProductGallery(
    product.imageUrl,
    product.galleryUrls,
    product.imageDerivatives
  );
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
  const [product, customer, emailAvailable] = await Promise.all([
    getPublishedProduct(slug),
    getCurrentCustomer(),
    isDeliveryQueueReady()
  ]);
  if (!product) notFound();

  const activeCart = customer
    ? await database.commerceCart.findFirst({
        select: { _count: { select: { items: true } } },
        where: { accountId: customer.accountId, status: "ACTIVE" }
      })
    : null;
  const specifications = extractProductSpecifications(product.specifications);
  const images = getProductGallery(
    product.imageUrl,
    product.galleryUrls,
    product.imageDerivatives
  );
  const frameColors = getProductImageFrameColors(
    product.imageUrl,
    product.galleryUrls,
    product.imageFrameColors,
    product.imageDerivatives
  );
  const accountPrice = customer
    ? getAccountPriceWithTax(
        product.basePriceWithTax,
        customer.account.commercialDiscountPct
      )
    : null;
  const availability = availabilityCopy(product);
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
      <SupplySubheader
        cartItemCount={activeCart?._count.items ?? 0}
        companyName={customer?.account.companyName}
        customerName={customer?.name}
      />
      <main className={styles.page}>
        <ProductEngagementTracker productId={product.id} />
        <div className={styles.breadcrumbs}>
          <Link href="/suministro/catalogo">CATÁLOGO</Link>
          <span>/</span>
          <Link
            href={`/suministro/catalogo?category=${encodeURIComponent(product.category)}`}
          >
            {upper(product.category)}
          </Link>
          <span>/</span>
          <b>{upper(product.brand ?? "PRODUCTO")}</b>
        </div>

        <section className={styles.hero}>
          <div className={styles.media}>
            <ProductGallery
              frameColors={frameColors}
              images={images}
              productId={product.id}
              productName={product.name}
            />
          </div>

          <div className={styles.productInfo}>
            <p className={styles.eyebrow}>
              {upper(product.category)} / {upper(product.brand ?? "PRODUCTO")}
            </p>
            <h1>{upper(product.name)}</h1>
            <p className={styles.lede}>{product.description}</p>

            <dl className={styles.identity}>
              <div>
                <dt>MARCA</dt>
                <dd>{upper(product.brand ?? "A CONFIRMAR")}</dd>
              </div>
              <div>
                <dt>SKU</dt>
                <dd>{product.sku}</dd>
              </div>
              <div>
                <dt>NÚMERO DE PARTE</dt>
                <dd>{product.partNumber ?? "A CONFIRMAR"}</dd>
              </div>
              <div>
                <dt>GARANTÍA</dt>
                <dd>
                  {product.warrantyYears
                    ? `${product.warrantyYears} ${product.warrantyYears === 1 ? "AÑO" : "AÑOS"}`
                    : "A CONFIRMAR"}
                </dd>
              </div>
            </dl>

            <section className={styles.commercial}>
              <div className={styles.commercialSummary}>
                <div className={styles.availability} aria-label="Disponibilidad">
                  <p>DISPONIBILIDAD</p>
                  <strong>{availability.value}</strong>
                  <span>{availability.label}</span>
                </div>
                <div>
                  <p>CONDICIÓN COMERCIAL</p>
                  <strong>
                    {customer ? formatMxn(accountPrice) : "PRECIO POR CUENTA"}
                  </strong>
                  {customer ? (
                    <span>
                      {accountPrice === null
                        ? "PRECIO SUJETO A VALIDACIÓN"
                        : "PRECIO PARA TU CUENTA / IVA INCLUIDO"}
                    </span>
                  ) : null}
                </div>
              </div>
              {customer ? (
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
              ) : (
                <div className={styles.accountActions}>
                  <Link href="/suministro/acceso">INGRESAR A MI CUENTA</Link>
                  <Link href="/suministro/registro">SOLICITAR CUENTA</Link>
                </div>
              )}
            </section>

            <ProductInformationActions
              defaultEmail={customer?.email}
              emailAvailable={emailAvailable}
              productId={product.id}
              productName={product.name}
              slug={product.slug}
            />
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

          <aside className={styles.sideRail}>
            <section className={styles.description}>
              <p>DESCRIPCIÓN</p>
              <h2>Lo esencial.</h2>
              <span>{product.description}</span>
            </section>
            <section className={styles.validation}>
              <p>ATENCIÓN COMERCIAL</p>
              <strong>Te ayudamos a elegir y confirmar antes de solicitar.</strong>
              <span>
                Revisamos existencias, compatibilidad, garantía y entrega para que tu
                compra llegue como la necesitas.
              </span>
              <a href="/contacto">HABLAR CON UN ASESOR</a>
            </section>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
