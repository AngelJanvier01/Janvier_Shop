import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalAccessForm } from "@/components/proposals/proposal-access-form";
import { ProposalCommentForm } from "@/components/proposals/proposal-comment-form";
import { ProposalDecisionForm } from "@/components/proposals/proposal-decision-form";
import { JanvierMarkdownRenderer } from "@/components/proposals/janvier-markdown-renderer";
import { ProposalOptionSelector } from "@/components/proposals/proposal-option-selector";
import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { database } from "@/lib/database";
import {
  proposalAccessCookieName,
  verifyProposalAccessCookie
} from "@/lib/proposals/invite-access";
import { hashInviteToken } from "@/lib/proposals/invite-security";
import { calculateProposalTotals } from "@/lib/proposals/proposal-snapshot";
import { proposalStatus } from "@/lib/proposals/proposal-state";
import { parseFrozenPublicProposalPackage } from "@/lib/proposals/markdown";

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

const sectionTypeLabels = {
  ALTERNATIVES: "ALTERNATIVAS",
  ARCHITECTURE: "ARQUITECTURA",
  CALLOUT: "NOTA TÉCNICA",
  CONTEXT: "CONTEXTO",
  COVER: "PORTADA",
  CUSTOM: "BLOQUE DE PROYECTO",
  DELIVERABLES: "ENTREGABLES",
  EXCLUSIONS: "EXCLUSIONES",
  EXECUTIVE_SUMMARY: "RESUMEN EJECUTIVO",
  FAQ: "PREGUNTAS FRECUENTES",
  INVESTMENT: "INVERSIÓN",
  METRICS: "MÉTRICAS",
  NEXT_STEPS: "SIGUIENTES PASOS",
  OBJECTIVES: "OBJETIVOS",
  PROBLEM: "PROBLEMA",
  REFERENCE: "REFERENCIA",
  SCOPE: "ALCANCE",
  SOLUTION: "SOLUCIÓN",
  TERMS: "CONDICIONES",
  TIMELINE: "FASES Y CALENDARIO"
} as const;

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { token } = await params;
  const invite = await database.proposalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      proposal: { include: { client: true } },
      revision: {
        include: {
          lineItems: {
            orderBy: { position: "asc" },
            select: {
              code: true,
              description: true,
              discount: true,
              optionId: true,
              position: true,
              quantity: true,
              taxRate: true,
              type: true,
              unitPrice: true,
              visibleForClient: true
            }
          },
          options: { orderBy: { position: "asc" }, where: { isEnabled: true } },
          sections: { orderBy: { position: "asc" } }
        }
      }
    }
  });

  if (!invite) {
    notFound();
  }

  if (invite.status !== "ACTIVE" || isExpired(invite.expiresAt)) {
    const revoked = invite.status === "REVOKED";
    return (
      <main className={styles.accessPage}>
        <section className={styles.accessCard}>
          <div className={styles.accessTopline}>
            <Link href="/" aria-label="JANVIER inicio" className={styles.accessBrand}>
              <BrandMark className={styles.accessMark} label="" />
              <span>JANVIER</span>
            </Link>
            <ThemeToggle />
          </div>
          <p className={styles.eyebrow}>PROJECT_ROOM / ACCESS_STATUS</p>
          <h1>{revoked ? "Este acceso fue revocado." : "Este acceso ya venció."}</h1>
          <p>
            {revoked
              ? "El enlace y el código anteriores ya no son válidos. Solicita una nueva invitación a JANVIER."
              : "La invitación llegó a su fecha límite. Solicita una nueva invitación a JANVIER."}
          </p>
          <Link className={styles.accessReturn} href="/contacto">
            CONTACTAR A JANVIER
          </Link>
        </section>
      </main>
    );
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
          <div className={styles.accessTopline}>
            <Link
              href="/"
              aria-label="JANVIER inicio"
              className={styles.accessBrand}
              data-testid="project-room-access-brand"
            >
              <BrandMark className={styles.accessMark} label="" />
              <span>JANVIER</span>
            </Link>
            <ThemeToggle />
          </div>
          <p className={styles.eyebrow}>PROJECT_ROOM / PRIVATE_ACCESS</p>
          <h1>Una propuesta preparada para ustedes.</h1>
          <p>
            Esta sala es privada. Introduce el código que acompañaba el enlace para
            revisar el proyecto.
          </p>
          <ProposalAccessForm token={token} />
          <small>Acceso protegido. No compartas este enlace ni el código.</small>
        </section>
      </main>
    );
  }

  const { proposal, revision } = invite;
  const frozen = parseFrozenPublicProposalPackage(revision.frozenPublicDocument);
  const canChooseOption =
    proposal.status === proposalStatus.SENT || proposal.status === proposalStatus.VIEWED;

  if (frozen.success) {
    const snapshot = frozen.data;
    const selectedOption = proposal.selectedOptionId
      ? (snapshot.commercial.alternatives.find(
          (option) => option.id === proposal.selectedOptionId
        ) ?? null)
      : null;
    const frozenClient = snapshot.document.variableContext.client;
    const frozenProposal = snapshot.document.variableContext.proposal;
    const clientName = frozenClient?.contactName ?? "Cliente";
    const clientEmail = frozenClient?.email ?? "";

    return (
      <main
        className={styles.proposal}
        data-project-room
        data-testid="frozen-project-room"
      >
        <header className={styles.header}>
          <Link href="/" aria-label="JANVIER inicio" className={styles.brand}>
            <BrandMark className={styles.brandMark} label="" />
            <span className={styles.brandLabel}>JANVIER</span>
          </Link>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <p>PROJECT_ROOM / {frozenProposal?.reference ?? proposal.reference}</p>
          </div>
        </header>

        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>
              PROPUESTA PRIVADA / REV {snapshot.revision} / FROZEN
            </p>
            <h1>{snapshot.document.header.title ?? frozenProposal?.title}</h1>
            <p className={styles.lead}>
              Documento compartido el {snapshot.resolvedVariables.currentDate as string}.
            </p>
          </div>
          <dl className={styles.meta}>
            <div>
              <dt>PREPARADA PARA</dt>
              <dd>{frozenClient?.companyName ?? clientName}</dd>
            </div>
            <div>
              <dt>VIGENTE HASTA</dt>
              <dd>{frozenProposal?.validUntil ?? "--"}</dd>
            </div>
            <div>
              <dt>INTEGRIDAD</dt>
              <dd>{snapshot.publicContentHash.slice(0, 12)}</dd>
            </div>
          </dl>
        </section>

        <div className={styles.divider} aria-hidden="true" />
        <section
          className={`${styles.content} ${styles.frozenContent}`}
          aria-label="Contenido congelado de la propuesta"
        >
          <JanvierMarkdownRenderer document={snapshot.document} label="FROZEN_PROPOSAL" />
        </section>

        {snapshot.commercial.alternatives.length ? (
          <section className={styles.investment}>
            <div>
              <p className={styles.eyebrow}>ALTERNATIVAS / CONGELADAS</p>
              <h2>Elige la alternativa para esta propuesta.</h2>
            </div>
            <div className={styles.priceArea}>
              {snapshot.commercial.alternatives.map((option) => (
                <article
                  className={
                    selectedOption?.id === option.id
                      ? styles.optionSelected
                      : styles.option
                  }
                  key={option.id}
                >
                  <div>
                    <p>
                      {option.recommended ? "RECOMENDADA / " : "OPCIÓN / "}
                      {option.code}
                    </p>
                    <h3>{option.title}</h3>
                    {option.description ? <span>{option.description}</span> : null}
                  </div>
                  <b>
                    {formatMoney(option.oneTime.total, snapshot.commercial.currency) ??
                      "A definir"}
                  </b>
                </article>
              ))}
              {canChooseOption ? (
                <ProposalOptionSelector
                  options={snapshot.commercial.alternatives.map((option) => ({
                    id: option.id,
                    title: option.title
                  }))}
                  selectedOptionId={selectedOption?.id ?? null}
                  token={token}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        <section className={styles.nextStep}>
          <div>
            <p className={styles.eyebrow}>SIGUIENTE PASO / PROJECT_ROOM</p>
            <h2>La conversación no termina en un documento.</h2>
            <p>Esta sala conserva exactamente la propuesta compartida para ustedes.</p>
          </div>
          <div className={styles.interactions}>
            {proposal.status === proposalStatus.ACCEPTED ? (
              <section className={styles.confirmed}>
                <p>PROPUESTA CONFIRMADA</p>
                <h3>Gracias. JANVIER ya recibió su aceptación.</h3>
              </section>
            ) : proposal.status === proposalStatus.DECLINED ? (
              <section className={styles.confirmed}>
                <p>PROPUESTA CERRADA</p>
                <h3>La decisión fue registrada. Gracias por tu tiempo.</h3>
              </section>
            ) : proposal.status === proposalStatus.CHANGES_REQUESTED ? (
              <section className={styles.confirmed}>
                <p>AJUSTES SOLICITADOS</p>
                <h3>JANVIER está preparando una nueva revisión para ustedes.</h3>
              </section>
            ) : (
              <ProposalDecisionForm email={clientEmail} name={clientName} token={token} />
            )}
            <details className={styles.notes}>
              <summary>¿Tienes una pregunta o nota para el equipo?</summary>
              <ProposalCommentForm email={clientEmail} name={clientName} token={token} />
            </details>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>JANVIER / PENSADO PARA LO QUE SIGUE.</p>
          <p>Expediente público congelado: {snapshot.publicContentHash}.</p>
        </footer>
      </main>
    );
  }

  const selectedOption = proposal.selectedOptionId
    ? (revision.options.find((option) => option.id === proposal.selectedOptionId) ?? null)
    : null;
  const totals = calculateProposalTotals({
    fallbackInvestment: revision.investment,
    lineItems: revision.lineItems,
    selectedOption
  });
  const total = formatMoney(totals.total, proposal.currency);
  const visibleSections = revision.sections.filter((section) => section.isIncluded);
  const visibleLineItems = revision.lineItems.filter(
    (lineItem) => lineItem.visibleForClient
  );

  return (
    <main className={styles.proposal} data-project-room>
      <header className={styles.header}>
        <Link href="/" aria-label="JANVIER inicio" className={styles.brand}>
          <BrandMark className={styles.brandMark} label="" />
          <span className={styles.brandLabel}>JANVIER</span>
        </Link>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <p>PROJECT_ROOM / {proposal.reference}</p>
        </div>
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
          <p>01 / PROPUESTA</p>
          <span>JANVIER SYSTEMS</span>
        </div>
        <div className={styles.sections}>
          {visibleSections.map((section, index) => (
            <article key={section.id} className={styles.section}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small className={styles.sectionType}>
                  {sectionTypeLabels[section.type]}
                </small>
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
            <p className={styles.eyebrow}>02 / INVERSIÓN</p>
            <h2>Una decisión con todo a la vista.</h2>
          </div>
          <div className={styles.priceArea}>
            {revision.options.map((option) => (
              <article
                className={
                  selectedOption?.id === option.id ? styles.optionSelected : styles.option
                }
                key={option.id}
              >
                <div>
                  <p>
                    {option.recommended ? "RECOMENDADA / " : "OPCIÓN / "}
                    {option.code}
                  </p>
                  <h3>{option.title}</h3>
                  {option.description ? <span>{option.description}</span> : null}
                  <small>
                    {option.taxIncluded
                      ? "Impuestos incluidos"
                      : "Impuestos no incluidos"}
                  </small>
                </div>
                <b>{formatMoney(option.investment, proposal.currency) ?? "A definir"}</b>
              </article>
            ))}
            {revision.options.length && canChooseOption ? (
              <ProposalOptionSelector
                options={revision.options.map((option) => ({
                  id: option.id,
                  title: option.title
                }))}
                selectedOptionId={selectedOption?.id ?? null}
                token={token}
              />
            ) : null}
            {visibleLineItems.length ? (
              <div className={styles.lineItems}>
                {visibleLineItems.map((lineItem) => (
                  <article key={lineItem.code}>
                    <span>{lineItem.code}</span>
                    <p>{lineItem.description}</p>
                    <b>
                      {formatMoney(
                        lineItem.quantity
                          .mul(lineItem.unitPrice)
                          .minus(lineItem.discount),
                        proposal.currency
                      )}
                    </b>
                  </article>
                ))}
              </div>
            ) : null}
            {total ? (
              <div className={styles.total}>
                <div>
                  <span>INVERSIÓN TOTAL</span>
                  <small>
                    {revision.taxIncluded
                      ? "Impuestos incluidos"
                      : "Impuestos no incluidos"}
                  </small>
                </div>
                <strong>{total}</strong>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {revision.terms ? (
        <section className={styles.terms}>
          <div className={styles.sectionLabel}>
            <p>03 / CONDICIONES</p>
            <span>LECTURA CLARA</span>
          </div>
          <div>
            <h2>Lo que necesitamos cuidar para avanzar bien.</h2>
            <p>{revision.terms}</p>
          </div>
        </section>
      ) : null}

      <section className={styles.nextStep}>
        <div>
          <p className={styles.eyebrow}>04 / SIGUIENTE PASO</p>
          <h2>La conversacion no termina en un documento.</h2>
          <p>
            Usa esta sala para confirmar la propuesta, pedir ajustes o dejar una nota para
            el equipo.
          </p>
        </div>
        <div className={styles.interactions}>
          {proposal.status === proposalStatus.ACCEPTED ? (
            <section className={styles.confirmed}>
              <p>PROPUESTA CONFIRMADA</p>
              <h3>Gracias. JANVIER ya recibio su aceptacion.</h3>
            </section>
          ) : proposal.status === proposalStatus.DECLINED ? (
            <section className={styles.confirmed}>
              <p>PROPUESTA CERRADA</p>
              <h3>La decisión fue registrada. Gracias por tu tiempo.</h3>
            </section>
          ) : proposal.status === proposalStatus.CHANGES_REQUESTED ? (
            <section className={styles.confirmed}>
              <p>AJUSTES SOLICITADOS</p>
              <h3>JANVIER está preparando una nueva revisión para ustedes.</h3>
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
