import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalInviteIssue } from "@/components/admin/proposal-invite-issue";
import { ProposalRevisionEditor } from "@/components/admin/proposal-revision-editor";
import { database } from "@/lib/database";
import {
  createEditableProposalRevision,
  revokeActiveProposalInvites
} from "@/app/(admin)/admin/propuestas/actions";

import styles from "./page.module.css";

type AdminProposalDetailPageProps = {
  params: Promise<{ proposalId: string }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "--";
  }
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export const metadata = {
  robots: { follow: false, index: false },
  title: "Detalle de propuesta"
};

export default async function AdminProposalDetailPage({
  params
}: AdminProposalDetailPageProps) {
  const { proposalId } = await params;
  const proposal = await database.proposal.findUnique({
    where: { id: proposalId },
    include: {
      client: true,
      comments: { orderBy: { createdAt: "desc" } },
      decisions: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
      invites: { orderBy: { createdAt: "desc" } },
      revisions: { orderBy: { revision: "desc" } }
    }
  });
  if (!proposal) {
    notFound();
  }
  const editableRevision = proposal.revisions.find((revision) => !revision.lockedAt);
  const activeInviteCount = proposal.invites.filter(
    (invite) => invite.status === "ACTIVE"
  ).length;

  return (
    <section className={styles.page}>
      <Link className={styles.back} href="/admin/propuestas">
        ← Todas las propuestas
      </Link>
      <header className={styles.hero}>
        <div>
          <p>{proposal.reference} / PROJECT_ROOM</p>
          <h1>{proposal.title}</h1>
        </div>
        <dl>
          <div>
            <dt>CLIENTE</dt>
            <dd>{proposal.client.companyName ?? proposal.client.contactName}</dd>
          </div>
          <div>
            <dt>CONTACTO</dt>
            <dd>{proposal.client.email}</dd>
          </div>
          <div>
            <dt>ESTADO</dt>
            <dd>{proposal.status}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.grid}>
        <ProposalInviteIssue proposalId={proposal.id} />
        <section className={styles.panel}>
          <p>REVISIONES / {proposal.revisions.length}</p>
          {proposal.revisions.map((revision) => (
            <article key={revision.id}>
              <span>REV {revision.revision}</span>
              <h2>{revision.title}</h2>
              <b>{revision.sharedAt ? "Compartida" : "Borrador compartible"}</b>
            </article>
          ))}
          {editableRevision ? null : (
            <form action={createEditableProposalRevision.bind(null, proposal.id)}>
              <button type="submit">Crear revision editable</button>
            </form>
          )}
          <div className={styles.inviteState}>
            <span>INVITACIONES ACTIVAS / {activeInviteCount}</span>
            {activeInviteCount ? (
              <form action={revokeActiveProposalInvites.bind(null, proposal.id)}>
                <button type="submit">Revocar accesos activos</button>
              </form>
            ) : null}
          </div>
        </section>
      </div>

      {editableRevision ? (
        <div className={styles.editor}>
          <ProposalRevisionEditor
            introduction={editableRevision.introduction}
            investment={editableRevision.investment?.toString() ?? null}
            revisionId={editableRevision.id}
            terms={editableRevision.terms}
            title={editableRevision.title}
          />
        </div>
      ) : null}

      <section className={styles.timeline}>
        <header>
          <p>ACTIVIDAD</p>
          <h2>Todo lo que ocurre queda registrado.</h2>
        </header>
        <div className={styles.events}>
          {proposal.events.length ? (
            proposal.events.map((event) => (
              <article key={event.id}>
                <span>{event.type}</span>
                <p>{formatDate(event.createdAt)}</p>
              </article>
            ))
          ) : (
            <p>Aun no hay actividad registrada.</p>
          )}
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <p>DECISIONES / {proposal.decisions.length}</p>
          {proposal.decisions.length ? (
            proposal.decisions.map((decision) => (
              <article key={decision.id}>
                <span>{decision.type}</span>
                <h2>{decision.actorName}</h2>
                <small>{decision.actorEmail ?? "Sin correo"}</small>
                {decision.note ? <p>{decision.note}</p> : null}
              </article>
            ))
          ) : (
            <p>Aun no hay una decision del cliente.</p>
          )}
        </section>
        <section className={styles.panel}>
          <p>NOTAS / {proposal.comments.length}</p>
          {proposal.comments.length ? (
            proposal.comments.map((comment) => (
              <article key={comment.id}>
                <span>{comment.authorName}</span>
                <small>{formatDate(comment.createdAt)}</small>
                <p>{comment.content}</p>
              </article>
            ))
          ) : (
            <p>Aun no hay notas del cliente.</p>
          )}
        </section>
      </div>
    </section>
  );
}
