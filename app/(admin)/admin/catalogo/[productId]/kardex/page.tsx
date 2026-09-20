import Link from "next/link";
import { notFound } from "next/navigation";

import { database } from "@/lib/database";

import styles from "./page.module.css";

type KardexPageProps = { params: Promise<{ productId: string }> };

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function money(value: { toString(): string } | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(Number(value.toString()));
}

function quantity(value: number | null) {
  return value === null ? "SIN LECTURA" : `${value} ${value === 1 ? "PIEZA" : "PIEZAS"}`;
}

export const metadata = {
  robots: { index: false, follow: false },
  title: "Kardex de producto"
};

export default async function ProductKardexPage({ params }: KardexPageProps) {
  const { productId } = await params;
  const product = await database.product.findUnique({
    select: {
      basePriceWithTax: true,
      name: true,
      sku: true,
      stockTotal: true,
      supplierLastSyncedAt: true,
      supplierCostWithTax: true,
      sicoddSyncRecords: {
        include: { run: { select: { startedAt: true, type: true } } },
        orderBy: { createdAt: "desc" },
        take: 240
      }
    },
    where: { id: productId }
  });
  if (!product) notFound();

  const lastPositiveStock = product.sicoddSyncRecords.find(
    (record) => (record.nextStockTotal ?? record.previousStockTotal ?? 0) > 0
  );
  const changeCount = product.sicoddSyncRecords.filter(
    (record) => record.changedFields.length > 0
  ).length;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href={`/admin/catalogo/${productId}`}>← VOLVER A LA FICHA</Link>
          <p>HISTORIAL DE PRECIOS Y EXISTENCIAS</p>
          <h1>{product.name}</h1>
          <span>SKU {product.sku}</span>
        </div>
        <Link className={styles.catalogLink} href="/admin/catalogo">
          VER CATÁLOGO
        </Link>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>EXISTENCIA ACTUAL</dt>
          <dd>{quantity(product.stockTotal)}</dd>
        </div>
        <div>
          <dt>PRECIO ACTUAL C/IVA</dt>
          <dd>{money(product.basePriceWithTax)}</dd>
        </div>
        <div>
          <dt>ÚLTIMA LECTURA</dt>
          <dd>{product.supplierLastSyncedAt ? dateTime(product.supplierLastSyncedAt) : "SIN LECTURA"}</dd>
        </div>
        <div>
          <dt>ÚLTIMA VEZ CON EXISTENCIAS</dt>
          <dd>{lastPositiveStock ? dateTime(lastPositiveStock.createdAt) : "SIN REGISTRO"}</dd>
        </div>
      </dl>

      <section className={styles.intro}>
        <p>
          {product.sicoddSyncRecords.length
            ? `${product.sicoddSyncRecords.length} LECTURAS GUARDADAS · ${changeCount} CON CAMBIOS`
            : "AÚN NO HAY LECTURAS GUARDADAS"}
        </p>
        <span>
          Cada renglón conserva lo que informó el proveedor en ese barrido. Sirve para
          consultar variaciones incluso cuando el artículo ya no tiene existencias.
        </span>
      </section>

      {product.sicoddSyncRecords.length ? (
        <section className={styles.timeline} aria-label="Movimientos del producto">
          {product.sicoddSyncRecords.map((record) => {
            const hasPriceChange = record.previousPriceWithTax !== record.nextPriceWithTax;
            const hasCostChange = record.previousCostWithTax !== record.nextCostWithTax;
            const hasStockChange = record.previousStockTotal !== record.nextStockTotal;
            return (
              <article key={record.id}>
                <header>
                  <div>
                    <time dateTime={record.createdAt.toISOString()}>{dateTime(record.createdAt)}</time>
                    <span>{record.run.type.replaceAll("_", " ")}</span>
                  </div>
                  <b data-result={record.result}>{record.result}</b>
                </header>
                <dl>
                  <div data-changed={hasStockChange}>
                    <dt>EXISTENCIAS</dt>
                    <dd>
                      {quantity(record.previousStockTotal)} <i>→</i> {quantity(record.nextStockTotal)}
                    </dd>
                  </div>
                  <div data-changed={hasPriceChange}>
                    <dt>PRECIO C/IVA</dt>
                    <dd>
                      {money(record.previousPriceWithTax)} <i>→</i> {money(record.nextPriceWithTax)}
                    </dd>
                  </div>
                  <div data-changed={hasCostChange}>
                    <dt>COSTO C/IVA</dt>
                    <dd>
                      {money(record.previousCostWithTax)} <i>→</i> {money(record.nextCostWithTax)}
                    </dd>
                  </div>
                  <div>
                    <dt>CAMBIOS DETECTADOS</dt>
                    <dd>{record.changedFields.length ? record.changedFields.join(", ") : "SIN CAMBIOS"}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.empty}>
          <h2>El historial aparecerá con la siguiente sincronización.</h2>
          <p>Cuando SICODD informe cambios, esta ficha conservará la comparación.</p>
        </section>
      )}
    </section>
  );
}
