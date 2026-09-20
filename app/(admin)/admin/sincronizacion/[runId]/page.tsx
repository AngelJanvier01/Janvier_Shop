import Link from "next/link";
import { notFound } from "next/navigation";

import { database } from "@/lib/database";

import styles from "./page.module.css";

type SyncReportPageProps = {
  params: Promise<{ runId: string }>;
};

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function money(value: { toString(): string } | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    style: "currency"
  }).format(Number(value.toString()));
}

export const metadata = {
  robots: { index: false, follow: false },
  title: "Reporte SICODD"
};

export default async function SicoddSyncReportPage({ params }: SyncReportPageProps) {
  const { runId } = await params;
  const run = await database.sicoddSyncRun.findUnique({
    include: {
      productRecords: {
        include: { product: { select: { name: true, slug: true, status: true } } },
        orderBy: [{ result: "asc" }, { createdAt: "asc" }]
      },
      requestedBy: { select: { email: true } }
    },
    where: { id: runId }
  });
  if (!run) notFound();

  const summary = run.productRecords.reduce(
    (total, record) => {
      total[record.result] += 1;
      total.imagesDetected += record.imagesDetected;
      total.imagesQueued += record.imagesQueued;
      total.imagesSkipped += record.imagesSkipped;
      if (record.nextStockTotal !== null && record.nextStockTotal <= 0)
        total.unavailable += 1;
      if (record.previousPriceWithTax !== null && record.nextPriceWithTax !== null) {
        const previous = Number(record.previousPriceWithTax);
        const next = Number(record.nextPriceWithTax);
        if (next > previous) total.priceUp += 1;
        if (next < previous) total.priceDown += 1;
      }
      return total;
    },
    {
      CREATED: 0,
      FAILED: 0,
      SKIPPED: 0,
      UNCHANGED: 0,
      UPDATED: 0,
      imagesDetected: 0,
      imagesQueued: 0,
      imagesSkipped: 0,
      priceDown: 0,
      priceUp: 0,
      unavailable: 0
    }
  );

  return (
    <section className={styles.page}>
      <Link className={styles.back} href="/admin/sincronizacion">
        ← VOLVER AL CENTRO DE SINCRONIZACIÓN
      </Link>
      <header>
        <p>SICODD / REPORTE DE EJECUCIÓN #{run.sequence ?? "—"}</p>
        <h1>
          {run.status === "COMPLETED" ? "Corrida terminada." : "Corrida en seguimiento."}
        </h1>
        <span>
          {dateLabel(run.startedAt)} ·{" "}
          {run.requestedBy?.email ?? "PROGRAMADOR DEL SISTEMA"}
        </span>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>NUEVOS</dt>
          <dd>{summary.CREATED}</dd>
        </div>
        <div>
          <dt>ACTUALIZADOS</dt>
          <dd>{summary.UPDATED}</dd>
        </div>
        <div>
          <dt>SIN CAMBIO</dt>
          <dd>{summary.UNCHANGED}</dd>
        </div>
        <div>
          <dt>FALLAS</dt>
          <dd>{summary.FAILED}</dd>
        </div>
        <div>
          <dt>PRECIO SUBIÓ</dt>
          <dd>{summary.priceUp}</dd>
        </div>
        <div>
          <dt>PRECIO BAJÓ</dt>
          <dd>{summary.priceDown}</dd>
        </div>
        <div>
          <dt>AGOTADOS</dt>
          <dd>{summary.unavailable}</dd>
        </div>
        <div>
          <dt>IMÁGENES NUEVAS</dt>
          <dd>{summary.imagesQueued}</dd>
        </div>
      </dl>

      <section className={styles.note}>
        <strong>{summary.imagesDetected} URLs DE IMAGEN DETECTADAS</strong>
        <span>
          {summary.imagesQueued} se pusieron en cola y {summary.imagesSkipped} se
          omitieron por ya existir, no haber cambiado o estar excluidas por
          administración.
        </span>
      </section>

      <section className={styles.records}>
        <header>
          <p>ARTÍCULOS</p>
          <h2>Cambios de esta ejecución</h2>
        </header>
        {run.productRecords.length ? (
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>RESULTADO</span>
              <span>ARTÍCULO</span>
              <span>PRECIO C/IVA</span>
              <span>STOCK</span>
              <span>CAMBIOS</span>
            </div>
            {run.productRecords.map((record) => {
              const priceChanged =
                record.previousPriceWithTax !== null &&
                record.nextPriceWithTax !== null &&
                Number(record.previousPriceWithTax) !== Number(record.nextPriceWithTax);
              return (
                <article key={record.id} data-result={record.result}>
                  <b>{record.result}</b>
                  <div>
                    {record.product ? (
                      <Link
                        href={`/admin/catalogo?${new URLSearchParams({ q: record.sku ?? record.externalKey })}`}
                      >
                        {record.product.name}
                      </Link>
                    ) : (
                      <strong>{record.sku ?? record.externalKey}</strong>
                    )}
                    <small>SKU {record.sku ?? "—"}</small>
                    {record.errorSummary ? <em>{record.errorSummary}</em> : null}
                  </div>
                  <span data-change={priceChanged ? "changed" : undefined}>
                    {money(record.previousPriceWithTax)} →{" "}
                    {money(record.nextPriceWithTax)}
                  </span>
                  <span>
                    {record.previousStockTotal ?? "—"} → {record.nextStockTotal ?? "—"}
                  </span>
                  <div className={styles.changes}>
                    {record.changedFields.length ? (
                      record.changedFields.map((field) => <i key={field}>{field}</i>)
                    ) : (
                      <i>SIN CAMBIO</i>
                    )}
                    <small>
                      {record.imagesQueued} IMG. NUEVAS · {record.imagesSkipped} OMITIDAS
                    </small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>
            Aún no hay artículos procesados para esta corrida.
          </p>
        )}
      </section>
    </section>
  );
}
