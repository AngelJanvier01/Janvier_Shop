import Link from "next/link";

import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Control Room"
};

export default async function AdminDashboardPage() {
  const [clientCount, diagnosticCount, newDiagnosticCount, proposalCount, projectCount] =
    await Promise.all([
      database.client.count(),
      database.diagnosticRequest.count({
        where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] } }
      }),
      database.diagnosticRequest.count({ where: { status: "NEW" } }),
      database.proposal.count(),
      database.project.count()
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
      </div>
      <section className={styles.next}>
        <p>INTAKE / FIRST_RESPONSE</p>
        <h2>Convierte el contexto correcto en la siguiente propuesta.</h2>
        <Link href="/admin/diagnosticos">Revisar diagnósticos</Link>
      </section>
    </section>
  );
}
