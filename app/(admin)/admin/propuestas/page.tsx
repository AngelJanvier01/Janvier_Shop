import { database } from "@/lib/database";
import Link from "next/link";
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
      <p>PROPUESTAS / ACCESO_PRIVADO</p>
      <h1>Propuestas</h1>
      <ProposalCreateForm />
      {proposals.length ? (
        <div className={styles.list}>
          {proposals.map((proposal) => (
            <Link href={`/admin/propuestas/${proposal.id}`} key={proposal.id}>
              <span>{proposal.reference}</span>
              <h2>{proposal.title}</h2>
              <p>{proposal.client.companyName ?? proposal.client.contactName}</p>
              <b>{proposal.status}</b>
            </Link>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>Aún no hay propuestas.</h2>
          <p>
            Crea una para definir sus secciones y generar un enlace privado para el cliente.
          </p>
        </section>
      )}
    </section>
  );
}
