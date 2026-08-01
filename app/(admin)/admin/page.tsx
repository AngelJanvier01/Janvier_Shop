import Link from "next/link";

import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Control Room"
};

export default async function AdminDashboardPage() {
  const [clientCount, proposalCount, projectCount] = await Promise.all([
    database.client.count(),
    database.proposal.count(),
    database.project.count()
  ]);

  return (
    <section className={styles.page}>
      <p>ADMIN / SYSTEM_READY</p>
      <h1>Control Room</h1>
      <div className={styles.metrics}>
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
        <p>PROJECT_ROOM / NEXT_MODULE</p>
        <h2>Crea la primera propuesta que tu cliente quiera recorrer.</h2>
        <Link href="/admin/propuestas">Abrir propuestas</Link>
      </section>
    </section>
  );
}
