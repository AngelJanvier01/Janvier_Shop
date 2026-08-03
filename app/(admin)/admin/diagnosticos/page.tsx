import { DiagnosticRequestBoard } from "@/components/admin/diagnostic-request-board";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Diagnósticos"
};

export default async function AdminDiagnosticsPage() {
  const requests = await database.diagnosticRequest.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100
  });

  return (
    <section className={styles.page}>
      <p>INTAKE / DIAGNOSTIC_PIPELINE</p>
      <h1>Diagnósticos</h1>
      <p className={styles.lede}>
        Cada solicitud llega con su contexto. Clasifícala, deja notas privadas y crea una
        propuesta sólo cuando tenga sentido.
      </p>
      <DiagnosticRequestBoard
        requests={requests.map((request) => ({
          ...request,
          createdAt: request.createdAt.toISOString()
        }))}
      />
    </section>
  );
}
