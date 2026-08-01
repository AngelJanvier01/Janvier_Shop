import { database } from "@/lib/database";
import { ProposalCreateForm } from "@/components/admin/proposal-create-form";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Propuestas"
};

export default async function AdminProposalsPage() {
  const proposals = await database.proposal.findMany({
    include: { client: true },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  return (
    <section className={styles.page}>
      <p>PROJECT_ROOM / PRIVATE_PROPOSALS</p>
      <h1>Propuestas</h1>
      <ProposalCreateForm />
      {proposals.length ? (
        <div className={styles.list}>
          {proposals.map((proposal) => (
            <article key={proposal.id}>
              <span>{proposal.reference}</span>
              <h2>{proposal.title}</h2>
              <p>{proposal.client.companyName ?? proposal.client.contactName}</p>
              <b>{proposal.status}</b>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>El espacio está listo para la primera propuesta.</h2>
          <p>
            El siguiente bloque permite crearla, generar un enlace privado y diseñar sus
            secciones sin depender de un PDF.
          </p>
        </section>
      )}
    </section>
  );
}
