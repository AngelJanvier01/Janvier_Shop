import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalInviteIssue } from "@/components/admin/proposal-invite-issue";
import { MarkdownDraftStudio } from "@/components/admin/markdown-draft-studio";
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
      project: true,
      revisions: {
        include: {
          options: { orderBy: { position: "asc" } },
          markdownSource: true,
          lineItems: {
            include: { option: { select: { code: true } } },
            orderBy: { position: "asc" }
          },
          sections: { orderBy: { position: "asc" } }
        },
        orderBy: { revision: "desc" }
      }
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
              <small>
                {revision.sections.length} bloques / {revision.options.length}{" "}
                alternativas
              </small>
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
          <MarkdownDraftStudio
            initialSource={
              editableRevision.markdownSource
                ? {
                    originalFileName: editableRevision.markdownSource.originalFileName,
                    parseStatus: editableRevision.markdownSource.parseStatus,
                    sourceHash: editableRevision.markdownSource.sourceHash,
                    sourceMarkdown: editableRevision.markdownSource.sourceMarkdown,
                    version: editableRevision.markdownSource.version
                  }
                : null
            }
            revisionId={editableRevision.id}
          />
          {!editableRevision.markdownSource ? (
            <ProposalRevisionEditor
              introduction={editableRevision.introduction}
              investment={editableRevision.investment?.toString() ?? null}
              options={editableRevision.options.map((option) => ({
                code: option.code,
                description: option.description,
                investment: option.investment?.toString() ?? null,
                isEnabled: option.isEnabled,
                recommended: option.recommended,
                taxIncluded: option.taxIncluded,
                title: option.title
              }))}
              lineItems={editableRevision.lineItems.map((lineItem) => ({
                code: lineItem.code,
                description: lineItem.description,
                discount: lineItem.discount.toString(),
                internalCost: lineItem.internalCost?.toString() ?? null,
                internalNotes: lineItem.internalNotes,
                markupPercent: lineItem.markupPercent?.toString() ?? null,
                optionCode: lineItem.option?.code ?? null,
                quantity: lineItem.quantity.toString(),
                taxRate: lineItem.taxRate.toString(),
                type: lineItem.type,
                unitPrice: lineItem.unitPrice.toString(),
                visibleForClient: lineItem.visibleForClient
              }))}
              revisionId={editableRevision.id}
              sections={editableRevision.sections.map((section) => ({
                content: section.content,
                isIncluded: section.isIncluded,
                title: section.title,
                type: section.type
              }))}
              taxIncluded={editableRevision.taxIncluded}
              terms={editableRevision.terms}
              title={editableRevision.title}
            />
          ) : null}
        </div>
      ) : null}

      {proposal.project ? (
        <section className={styles.projectLinked}>
          <p>PROJECT_LINKED / PRIVATE</p>
          <h2>{proposal.project.title}</h2>
          <span>El proyecto ya está vinculado a esta propuesta.</span>
        </section>
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
