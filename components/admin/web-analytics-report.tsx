import type { getWebAnalyticsReport } from "@/lib/analytics/report";

import styles from "./web-analytics-report.module.css";

type AnalyticsReport = Awaited<ReturnType<typeof getWebAnalyticsReport>>;

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RankedList({
  empty,
  items,
  title
}: {
  empty: string;
  items: Array<{ label: string; value: number }>;
  title: string;
}) {
  return (
    <section className={styles.ranked}>
      <h2>{title}</h2>
      {items.length ? (
        <ol>
          {items.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <b>{item.value}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

export function WebAnalyticsReport({ report }: { report: AnalyticsReport }) {
  const maxDailyViews = Math.max(...report.daily.map((day) => day.views), 1);

  return (
    <div className={styles.report} data-testid="web-analytics-report">
      <div className={styles.metrics}>
        <Metric label="VISTAS / 7D" value={report.views} />
        <Metric label="SESIONES ANÓNIMAS / 7D" value={report.uniqueSessions} />
        <Metric label="CLICS ÚTILES / 7D" value={report.callsToAction} />
        <Metric label="DIAGNÓSTICOS / 7D" value={report.diagnosticConversions} />
        <Metric label="CONVERSIÓN A DIAGNÓSTICO" value={`${report.conversionRate}%`} />
      </div>

      <section className={styles.timeline}>
        <div>
          <h2>Actividad de los últimos 14 días</h2>
          <p>Vistas, sesiones anónimas y clics marcados como intención comercial.</p>
        </div>
        <ol aria-label="Actividad diaria">
          {report.daily.map((day) => (
            <li key={day.date}>
              <span
                className={styles.bar}
                style={{ height: `${(day.views / maxDailyViews) * 100}%` }}
              />
              <b>{day.views}</b>
              <small>{day.date.slice(5)}</small>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.rankedGrid}>
        <RankedList
          empty="Aún no hay vistas registradas."
          items={report.topPages}
          title="Rutas más vistas"
        />
        <RankedList
          empty="Aún no hay CTAs marcados."
          items={report.topCtas}
          title="Intenciones y CTAs"
        />
        <RankedList
          empty="Sin fuentes externas registradas."
          items={report.topSources}
          title="Fuentes de llegada"
        />
      </div>

      <p className={styles.note}>
        Medición first-party: no guarda IP, correo, user-agent, texto escrito, parámetros
        de URL ni un identificador persistente. Las sesiones se reinician al cerrar la
        pestaña.
        {report.limitReached
          ? " El límite de lectura se alcanzó; reduce el periodo o aplica la limpieza de retención."
          : ""}
      </p>
    </div>
  );
}
