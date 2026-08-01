import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { createWhatsAppUrl } from "@/components/layout/navigation";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

function extractSpecificationItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  const items = (value as { items?: unknown }).items;
  return Array.isArray(items)
    ? items.filter((item): item is string => typeof item === "string")
    : [];
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await database.product.findFirst({
    where: { slug, status: "PUBLISHED" }
  });
  if (!product) {
    notFound();
  }
  const specifications = extractSpecificationItems(product.specifications);
  const whatsappUrl = createWhatsAppUrl(
    `Hola, me interesa ${product.name} (SKU ${product.sku}). Quisiera confirmar disponibilidad, condiciones y cotizacion.`
  );

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <Link className={styles.back} href="/suministro/catalogo">
          ← Volver al catalogo
        </Link>
        <section className={styles.hero}>
          <div>
            <p>
              {product.category} / SKU {product.sku}
            </p>
            <h1>{product.name}</h1>
            <p className={styles.description}>{product.description}</p>
          </div>
          <dl>
            <div>
              <dt>MARCA</dt>
              <dd>{product.brand ?? "A confirmar"}</dd>
            </div>
            <div>
              <dt>DISPONIBILIDAD</dt>
              <dd>
                {product.specialOrder
                  ? "Validar bajo pedido"
                  : "Confirmar antes de cotizar"}
              </dd>
            </div>
            <div>
              <dt>PRECIO</dt>
              <dd>Segun volumen, vigencia y condiciones</dd>
            </div>
          </dl>
        </section>
        <section className={styles.request}>
          <div>
            <p>REQUEST / HUMAN_VALIDATION</p>
            <h2>Primero confirmamos. Luego cotizamos.</h2>
          </div>
          <div>
            <p>
              Revisamos existencia, configuracion, garantia, envio y condiciones antes de
              pedirte un pago.
            </p>
            <a href={whatsappUrl} rel="noreferrer" target="_blank">
              Solicitar este producto
            </a>
          </div>
        </section>
        {specifications.length ? (
          <section className={styles.specifications}>
            <p>FICHA TECNICA</p>
            <ul>
              {specifications.map((specification) => (
                <li key={specification}>{specification}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
