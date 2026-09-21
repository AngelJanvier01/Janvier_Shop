import Link from "next/link";

import type { getProductEngagementReport } from "@/lib/analytics/product-engagement-report";

import styles from "./product-engagement-report.module.css";

type ProductEngagementReportData = Awaited<ReturnType<typeof getProductEngagementReport>>;

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function ProductEngagementReport({
  report
}: {
  report: ProductEngagementReportData;
}) {
  const detail = report.detail;
  return (
    <section className={styles.report} data-testid="product-engagement-report">
      <header>
        <div>
          <p>COMMERCE_INTELLIGENCE / {report.days}D</p>
          <h2>Interés por producto.</h2>
          <span>
            Señales first-party de fichas, galerías, fichas técnicas y listas comerciales.
          </span>
        </div>
        {detail ? <Link href="/admin/analitica">CERRAR DETALLE</Link> : null}
      </header>

      <div className={styles.metrics}>
        <Metric label="VISTAS DE FICHA" value={report.metrics.productViews} />
        <Metric label="GALERÍAS COMPLETAS" value={report.metrics.galleryCompletions} />
        <Metric label="FICHAS TÉCNICAS" value={report.metrics.sheetViews} />
        <Metric label="ALTAS A LISTA" value={report.metrics.cartAdds} />
      </div>

      {detail ? (
        <section className={styles.detail}>
          <header>
            <div>
              <p>
                {upper(detail.product.brand ?? "SIN MARCA")} / {upper(detail.product.sku)}
              </p>
              <h3>{upper(detail.product.name)}</h3>
              <span>
                {detail.product.status === "PUBLISHED" ? "PUBLICADO" : "NO PÚBLICO"} /
                SEÑALES DE LOS ÚLTIMOS {report.days} DÍAS
              </span>
            </div>
            <Link href={`/admin/catalogo/${detail.product.id}`}>ABRIR FICHA ↗</Link>
          </header>
          <div className={styles.detailMetrics}>
            <Metric label="VISTAS" value={detail.views} />
            <Metric label="SESIONES ÚNICAS" value={detail.uniqueViewSessions} />
            <Metric label="RECORRIDO COMPLETO" value={`${detail.galleryRate}%`} />
            <Metric label="AL CARRITO" value={detail.cartAdds} />
          </div>
          <section className={styles.viewerTable}>
            <div>
              <h4>Personas identificadas que interactuaron</h4>
              <p>
                Sólo cuentas comerciales que iniciaron sesión; las visitas anónimas se
                muestran únicamente de forma agregada.
              </p>
            </div>
            {detail.viewers.length ? (
              <ol>
                {detail.viewers.map((viewer) => (
                  <li key={`${viewer.email}-${viewer.viewedAt.toISOString()}`}>
                    <span>
                      <b>{upper(viewer.name)}</b>
                      <small>
                        {upper(viewer.companyName)} / {viewer.email}
                      </small>
                    </span>
                    <em>{upper(viewer.eventType.replaceAll("_", " "))}</em>
                    <time dateTime={viewer.viewedAt.toISOString()}>
                      {dateLabel(viewer.viewedAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>
                Aún no hay interacciones identificadas en este periodo.
              </p>
            )}
          </section>
          {detail.eventReadLimitReached ? (
            <p className={styles.limit}>
              El detalle alcanzó su límite de lectura; ajusta la retención o reduce el
              periodo.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={styles.leaderboard}>
        <header>
          <div>
            <p>FICHAS CON MAYOR INTERÉS</p>
            <h3>Productos que necesitan seguimiento.</h3>
          </div>
          <span>{report.leaderboard.length} PRODUCTOS CON ACTIVIDAD</span>
        </header>
        {report.leaderboard.length ? (
          <ol>
            {report.leaderboard.map((product) => (
              <li key={product.id}>
                <div>
                  <b>{upper(product.name)}</b>
                  <span>
                    {upper(product.brand ?? "SIN MARCA")} / SKU {upper(product.sku)}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>VISTAS</dt>
                    <dd>{product.views}</dd>
                  </div>
                  <div>
                    <dt>GALERÍA</dt>
                    <dd>{product.galleryRate}%</dd>
                  </div>
                  <div>
                    <dt>FICHA</dt>
                    <dd>{product.sheetViews}</dd>
                  </div>
                  <div>
                    <dt>LISTA</dt>
                    <dd>{product.cartAdds}</dd>
                  </div>
                </dl>
                <Link href={`/admin/analitica?product=${encodeURIComponent(product.id)}`}>
                  VER DETALLE ↗
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>
            Aún no hay actividad comercial de producto en este periodo.
          </p>
        )}
      </section>
      <p className={styles.note}>
        Una galería completa sólo se registra cuando una persona explora de forma manual
        todas sus imágenes. No se guardan IP, contraseñas, user-agent ni texto escrito.
      </p>
    </section>
  );
}
