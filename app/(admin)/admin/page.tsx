import Link from "next/link";

import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Control Room"
};

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export default async function AdminDashboardPage() {
  const analyticsSince = sevenDaysAgo();
  const [
    clientCount,
    diagnosticCount,
    newDiagnosticCount,
    proposalCount,
    projectCount,
    weeklyViews
  ] = await Promise.all([
    database.client.count(),
    database.diagnosticRequest.count({
      where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] } }
    }),
    database.diagnosticRequest.count({ where: { status: "NEW" } }),
    database.proposal.count(),
    database.project.count(),
    database.webAnalyticsEvent.count({
      where: {
        createdAt: { gte: analyticsSince },
        eventType: "PAGE_VIEW"
      }
    })
  ]);

  return (
    <section className={styles.page}>
      <p>ADMIN / SYSTEM_READY</p>
      <h1>Control Room</h1>
      <div className={styles.metrics}>
        <article>
          <span>DIAGNÓSTICOS ACTIVOS</span>
          <strong>{diagnosticCount}</strong>
        </article>
        <article>
          <span>NUEVOS</span>
          <strong>{newDiagnosticCount}</strong>
        </article>
        <article>
          <span>CLIENTES</span>
          <strong>{clientCount}</strong>
        </article>
        <article>
          <span>PROYECTOS</span>
          <strong>{projectCount}</strong>
        </article>
        <article>
          <span>PROPUESTAS</span>
          <strong>{proposalCount}</strong>
        </article>
        <article>
          <span>VISTAS / 7D</span>
          <strong>{weeklyViews}</strong>
        </article>
      </div>
      <section className={styles.next}>
        <p>INTAKE / FIRST_RESPONSE</p>
        <h2>Convierte el contexto correcto en la siguiente propuesta.</h2>
        <Link href="/admin/diagnosticos">Revisar diagnósticos</Link>
        <Link href="/admin/analitica">Abrir analítica</Link>
      </section>
    </section>
  );
}
