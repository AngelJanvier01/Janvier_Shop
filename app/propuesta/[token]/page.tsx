import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalAccessForm } from "@/components/proposals/proposal-access-form";
import { ProposalCommentForm } from "@/components/proposals/proposal-comment-form";
import { ProposalDecisionForm } from "@/components/proposals/proposal-decision-form";
import { database } from "@/lib/database";
import {
  proposalAccessCookieName,
  verifyProposalAccessCookie
} from "@/lib/proposals/invite-access";
import { hashInviteToken } from "@/lib/proposals/invite-security";

import styles from "./page.module.css";

type ProposalPageProps = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Propuesta privada"
};

function formatMoney(amount: unknown, currency: string) {
  if (amount === null || amount === undefined) {
    return null;
  }

  return new Intl.NumberFormat("es-MX", {
    currency,
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Number(amount));
}

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function isExpired(date: Date) {
  return date.getTime() <= Date.now();
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { token } = await params;
  const invite = await database.proposalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      proposal: { include: { client: true } },
      revision: {
        include: {
          options: { orderBy: { position: "asc" } },
          sections: { orderBy: { position: "asc" } }
        }
      }
    }
  });

  if (!invite || invite.status !== "ACTIVE" || isExpired(invite.expiresAt)) {
    notFound();
  }

  const cookieStore = await cookies();
  const isAllowed = verifyProposalAccessCookie(
    token,
    cookieStore.get(proposalAccessCookieName(token))?.value
  );

  if (!isAllowed) {
    return (
      <main className={styles.accessPage}>
        <section className={styles.accessCard}>
          <p className={styles.eyebrow}>JANVIER / PROJECT_ROOM</p>
          <span className={styles.mark} aria-hidden="true">
            J
          </span>
          <h1>Una propuesta preparada para ustedes.</h1>
          <p>
            Esta sala es privada. Introduce el codigo que acompanaba el enlace para
            revisar el proyecto.
          </p>
          <ProposalAccessForm token={token} />
          <small>Acceso protegido. No compartas este enlace ni el codigo.</small>
        </section>
      </main>
    );
  }

  const { proposal, revision } = invite;
  const total = formatMoney(revision.investment, proposal.currency);

  return (
    <main className={styles.proposal}>
      <header className={styles.header}>
        <Link href="/" aria-label="JANVIER inicio" className={styles.brand}>
          <span aria-hidden="true">J</span> JANVIER
        </Link>
        <p>PROJECT_ROOM / {proposal.reference}</p>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PROPUESTA PRIVADA / REV {revision.revision}</p>
          <h1>{revision.title}</h1>
          {revision.introduction ? (
            <p className={styles.lead}>{revision.introduction}</p>
          ) : null}
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>PREPARADA PARA</dt>
            <dd>{proposal.client.companyName ?? proposal.client.contactName}</dd>
          </div>
          <div>
            <dt>CONTACTO</dt>
            <dd>{proposal.client.contactName}</dd>
          </div>
          {proposal.validUntil ? (
            <div>
              <dt>VIGENTE HASTA</dt>
              <dd>{formatDate(proposal.validUntil)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className={styles.divider} aria-hidden="true" />

      <section className={styles.content} aria-label="Contenido de la propuesta">
        <div className={styles.sectionLabel}>
          <p>01 / ALCANCE</p>
          <span>JANVIER SYSTEMS</span>
        </div>
        <div className={styles.sections}>
          {revision.sections.map((section, index) => (
            <article key={section.id} className={styles.section}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                {section.content ? <p>{section.content}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {revision.options.length || total ? (
        <section className={styles.investment}>
          <div>
            <p className={styles.eyebrow}>02 / INVERSION</p>
            <h2>Una decision con todo a la vista.</h2>
          </div>
          <div className={styles.priceArea}>
            {revision.options.map((option) => (
              <article className={styles.option} key={option.id}>
                <div>
                  <p>
                    {option.recommended ? "RECOMENDADA / " : "OPCION / "}
                    {option.code}
                  </p>
                  <h3>{option.title}</h3>
                  {option.description ? <span>{option.description}</span> : null}
                </div>
                <b>{formatMoney(option.investment, proposal.currency) ?? "A definir"}</b>
              </article>
            ))}
            {total ? (
              <div className={styles.total}>
                <span>INVERSION TOTAL</span>
                <strong>{total}</strong>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={styles.nextStep}>
        <div>
          <p className={styles.eyebrow}>03 / SIGUIENTE PASO</p>
          <h2>La conversacion no termina en un documento.</h2>
          <p>
            Usa esta sala para confirmar la propuesta, pedir ajustes o dejar una nota para
            el equipo.
          </p>
        </div>
        <div className={styles.interactions}>
          {proposal.status === "ACCEPTED" ? (
            <section className={styles.confirmed}>
              <p>PROPUESTA CONFIRMADA</p>
              <h3>Gracias. JANVIER ya recibio su aceptacion.</h3>
            </section>
          ) : (
            <ProposalDecisionForm
              email={proposal.client.email}
              name={proposal.client.contactName}
              token={token}
            />
          )}
          <details className={styles.notes}>
            <summary>¿Tienes una pregunta o nota para el equipo?</summary>
            <ProposalCommentForm
              email={proposal.client.email}
              name={proposal.client.contactName}
              token={token}
            />
          </details>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>JANVIER / PENSADO PARA LO QUE SIGUE.</p>
        <p>Esta propuesta es privada y corresponde a {proposal.reference}.</p>
      </footer>
    </main>
  );
}
