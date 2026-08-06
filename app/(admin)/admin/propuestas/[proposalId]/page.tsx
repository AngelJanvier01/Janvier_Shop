import Link from "next/link";
import { notFound } from "next/navigation";

import { ProposalInviteIssue } from "@/components/admin/proposal-invite-issue";
import { MarkdownDraftStudio } from "@/components/admin/markdown-draft-studio";
import { MarkdownHistoryPanel } from "@/components/admin/markdown-history-panel";
import { ProposalAssetsManager } from "@/components/admin/proposal-assets-manager";
import { ProposalCommercialStudio } from "@/components/admin/proposal-commercial-studio";
import { ProposalRevisionEditor } from "@/components/admin/proposal-revision-editor";
import { CreateEditableRevisionButton } from "@/components/admin/create-editable-revision-button";
import { JanvierDocumentRenderBoundary } from "@/components/proposals/janvier-document-render-boundary";
import { JanvierMarkdownRenderer } from "@/components/proposals/janvier-markdown-renderer";
import { database } from "@/lib/database";
import {
  getProposalAssetAdminItems,
  getProposalAssetManifest,
  getProposalMarkdownAssetReport,
  publicAssetManifest,
  type MarkdownAssetReport
} from "@/lib/proposals/assets";
import {
  assertPublicCommercialPrivacy,
  buildPublicProposalCommercialDto,
  type PublicProposalCommercialDTO
} from "@/lib/proposals/commercial-dto";
import {
  buildAdminJanvierDocument,
  buildPublicJanvierDocument,
  janvierDocumentSchema,
  parseJanvierMarkdown,
  type JanvierRenderedDocument
} from "@/lib/proposals/markdown";
import { canCreateEditableProposalRevision } from "@/lib/proposals/proposal-state";
import { revokeActiveProposalInvites } from "@/app/(admin)/admin/propuestas/actions";

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

function formatDocumentDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(date);
}

type RenderedMarkdownPanel =
  | {
      admin: JanvierRenderedDocument;
      assetReport: MarkdownAssetReport;
      error: null;
      preview: JanvierRenderedDocument;
    }
  | { admin: null; assetReport: null; error: string; preview: null };

async function createRenderedMarkdownPanel(input: {
  client: { companyName: string | null; contactName: string; email: string };
  currentDate: Date;
  ownerName: string | null;
  proposal: {
    currency: string;
    reference: string;
    title: string;
    validUntil: Date | null;
  };
  revision: {
    commercial?: PublicProposalCommercialDTO;
    id: string;
    markdownSource: { normalizedAst: unknown; sourceMarkdown: string } | null;
    sections: Array<{ removedAt: Date | null; sourceId: string }>;
  };
}): Promise<RenderedMarkdownPanel | null> {
  const source = input.revision.markdownSource;
  if (!source) {
    return null;
  }

  const cached = janvierDocumentSchema.safeParse(source.normalizedAst);
  const reparsed = cached.success ? null : parseJanvierMarkdown(source.sourceMarkdown);
  if (!cached.success && reparsed?.status === "ERROR") {
    return {
      admin: null,
      assetReport: null,
      error:
        "El AST guardado no es válido y la fuente no pudo repararse de forma segura.",
      preview: null
    };
  }

  const document = cached.success ? cached.data : reparsed?.document;
  if (!document) {
    return {
      admin: null,
      assetReport: null,
      error: "No existe un documento JANVIER válido para representar.",
      preview: null
    };
  }

  try {
    const assetManifest = await getProposalAssetManifest(input.revision.id, true);
    const assetReport = await getProposalMarkdownAssetReport(input.revision.id, document);
    const removedSectionSourceIds = new Set(
      input.revision.sections
        .filter((section) => section.removedAt)
        .map((section) => section.sourceId)
    );
    const variableContext = {
      author: { name: input.ownerName },
      client: input.client,
      currentDate: formatDocumentDate(input.currentDate),
      proposal: {
        currency: input.revision.commercial?.currency ?? input.proposal.currency,
        deliveryTerms: input.revision.commercial?.terms.deliveryTerms ?? null,
        paymentTermsSummary: input.revision.commercial?.terms.paymentTermsSummary ?? null,
        reference: input.proposal.reference,
        supportSummary: input.revision.commercial?.terms.supportSummary ?? null,
        title: input.proposal.title,
        validUntil: input.revision.commercial?.terms.validUntil
          ? formatDocumentDate(new Date(input.revision.commercial.terms.validUntil))
          : input.proposal.validUntil
            ? formatDocumentDate(input.proposal.validUntil)
            : null,
        warrantySummary: input.revision.commercial?.terms.warrantySummary ?? null
      }
    };
    return {
      admin: buildAdminJanvierDocument(document, {
        assetManifest,
        commercial: input.revision.commercial,
        removedSectionSourceIds,
        variableContext
      }),
      assetReport,
      error: null,
      preview: buildPublicJanvierDocument(document, {
        assetManifest: publicAssetManifest(assetManifest),
        commercial: input.revision.commercial,
        mode: "ADMIN_PREVIEW",
        removedSectionSourceIds,
        variableContext
      })
    };
  } catch {
    return {
      admin: null,
      assetReport: null,
      error:
        "La representación se bloqueó porque el documento no cumple el registro JANVIER.",
      preview: null
    };
  }
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
      invites: {
        include: { viewers: { orderBy: { lastViewedAt: "desc" } } },
        orderBy: { createdAt: "desc" }
      },
      owner: { select: { name: true } },
      project: true,
      revisions: {
        include: {
          options: { orderBy: { position: "asc" } },
          markdownSource: {
            include: {
              checkpoints: {
                orderBy: { sequence: "desc" },
                select: {
                  createdAt: true,
                  id: true,
                  reason: true,
                  sequence: true,
                  sourceHash: true
                },
                take: 25
              }
            }
          },
          lineItems: {
            include: { option: { select: { code: true } } },
            orderBy: { position: "asc" }
          },
          paymentStages: {
            include: { option: { select: { code: true } } },
            orderBy: { position: "asc" }
          },
          sections: { orderBy: { position: "asc" } },
          timelinePhases: {
            include: {
              deliverables: { orderBy: { position: "asc" } },
              dependencies: {
                include: { dependsOnPhase: { select: { code: true } } }
              },
              option: { select: { code: true } }
            },
            orderBy: { position: "asc" }
          }
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
  const totalDocumentViews = proposal.invites.reduce(
    (total, invite) => total + invite.viewCount,
    0
  );
  const inviteViewers = proposal.invites.flatMap((invite) =>
    invite.viewers.map((viewer) => ({ ...viewer, inviteId: invite.id }))
  );
  const commercial = editableRevision
    ? buildPublicProposalCommercialDto({
        commercialCalculationVersion: editableRevision.commercialCalculationVersion,
        currency: editableRevision.currency,
        deliveryTerms: editableRevision.deliveryTerms,
        lineItems: editableRevision.lineItems.map((lineItem) => ({
          billingType: lineItem.billingType,
          code: lineItem.code,
          contingencyPercent: lineItem.contingencyPercent,
          description: lineItem.description,
          discountType: lineItem.discountType,
          discountValue: lineItem.discountValue,
          id: lineItem.id,
          internalCost: lineItem.internalCost,
          isActive: lineItem.isActive,
          isIncluded: lineItem.isIncluded,
          isOptional: lineItem.isOptional,
          isTaxable: lineItem.isTaxable,
          markupPercent: lineItem.markupPercent,
          name: lineItem.name,
          optionId: lineItem.optionId,
          pricingMode: lineItem.pricingMode,
          quantity: lineItem.quantity,
          scope: lineItem.scope,
          selectedByDefault: lineItem.selectedByDefault,
          taxIncluded: lineItem.taxIncluded,
          taxRate: lineItem.taxRate,
          unit: lineItem.unit,
          unitPrice: lineItem.unitPrice,
          visibleToClient: lineItem.visibleToClient
        })),
        options: editableRevision.options.map((option) => ({
          code: option.code,
          conditionsSummary: option.conditionsSummary,
          description: option.description,
          estimatedDuration: option.estimatedDuration,
          id: option.id,
          isActive: option.isActive,
          recommended: option.recommended,
          supportSummary: option.supportSummary,
          title: option.title
        })),
        paymentStages: editableRevision.paymentStages.map((stage) => ({
          calculationType: stage.calculationType,
          description: stage.description,
          dueDays: stage.dueDays,
          fixedAmount: stage.fixedAmount,
          id: stage.id,
          optionId: stage.optionId,
          option: stage.option,
          percentage: stage.percentage,
          position: stage.position,
          title: stage.title,
          triggerDescription: stage.triggerDescription,
          triggerType: stage.triggerType,
          visibleToClient: stage.visibleToClient
        })),
        paymentTermsSummary: editableRevision.paymentTermsSummary,
        supportSummary: editableRevision.supportSummary,
        timelinePhases: editableRevision.timelinePhases,
        validUntil: editableRevision.validUntil,
        warrantySummary: editableRevision.warrantySummary
      })
    : null;
  if (commercial) {
    assertPublicCommercialPrivacy(commercial);
  }
  const [markdownPanel, assetItems] = editableRevision
    ? await Promise.all([
        createRenderedMarkdownPanel({
          client: proposal.client,
          currentDate: new Date(),
          ownerName: proposal.owner.name,
          proposal,
          revision: { ...editableRevision, commercial: commercial ?? undefined }
        }),
        getProposalAssetAdminItems(editableRevision.id)
      ])
    : [null, []];

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
        <ProposalInviteIssue
          proposalId={proposal.id}
          proposalReference={proposal.reference}
          proposalTitle={proposal.title}
        />
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
          {editableRevision ? null : canCreateEditableProposalRevision(
              proposal.status
            ) ? (
            <CreateEditableRevisionButton proposalId={proposal.id} />
          ) : (
            <small>Esta propuesta ya no permite abrir una revisión editable.</small>
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
        <section className={styles.panel}>
          <p>LECTURAS / {totalDocumentViews}</p>
          <small>
            {inviteViewers.length} persona{inviteViewers.length === 1 ? "" : "s"} con
            acceso registrado
          </small>
          {inviteViewers.length ? (
            inviteViewers.map((viewer) => (
              <article key={viewer.id}>
                <span>{viewer.name}</span>
                <h2>
                  {viewer.viewCount} apertura{viewer.viewCount === 1 ? "" : "s"}
                </h2>
                <small>
                  {viewer.lastViewedAt
                    ? `Última apertura: ${formatDate(viewer.lastViewedAt)}`
                    : "Acceso validado; aún no abre el documento."}
                </small>
              </article>
            ))
          ) : (
            <p>Aún no hay aperturas registradas.</p>
          )}
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
          <MarkdownHistoryPanel
            checkpoints={
              editableRevision.markdownSource?.checkpoints.map((checkpoint) => ({
                createdAt: checkpoint.createdAt.toISOString(),
                id: checkpoint.id,
                reason: checkpoint.reason,
                sequence: checkpoint.sequence,
                sourceHash: checkpoint.sourceHash
              })) ?? []
            }
            revisionId={editableRevision.id}
          />
          <ProposalAssetsManager
            initialAssets={assetItems}
            initialReport={markdownPanel?.assetReport ?? null}
            revisionId={editableRevision.id}
          />
          <ProposalCommercialStudio
            initial={{
              commercialVersion: editableRevision.commercialVersion,
              currency: editableRevision.currency,
              deliveryTerms: editableRevision.deliveryTerms,
              lineItems: editableRevision.lineItems.map((lineItem) => ({
                billingType: lineItem.billingType,
                code: lineItem.code,
                contingencyPercent: lineItem.contingencyPercent?.toString() ?? null,
                description: lineItem.description || null,
                discountType: lineItem.discountType,
                discountValue: lineItem.discountValue.toString(),
                id: lineItem.id,
                internalCost: lineItem.internalCost?.toString() ?? null,
                internalNotes: lineItem.internalNotes,
                isActive: lineItem.isActive,
                isIncluded: lineItem.isIncluded,
                isOptional: lineItem.isOptional,
                isTaxable: lineItem.isTaxable,
                markupPercent: lineItem.markupPercent?.toString() ?? null,
                name: lineItem.name,
                optionCode: lineItem.option?.code ?? null,
                pricingMode: lineItem.pricingMode,
                quantity: lineItem.quantity.toString(),
                scope: lineItem.scope,
                selectedByDefault: lineItem.selectedByDefault,
                supplier: lineItem.supplier,
                supplierReference: lineItem.supplierReference,
                taxIncluded: lineItem.taxIncluded,
                taxRate: lineItem.taxRate.toString(),
                unit: lineItem.unit,
                unitPrice: lineItem.unitPrice.toString(),
                visibleToClient: lineItem.visibleToClient
              })),
              options: editableRevision.options.map((option) => ({
                code: option.code,
                conditionsSummary: option.conditionsSummary,
                description: option.description,
                estimatedDuration: option.estimatedDuration,
                id: option.id,
                isActive: option.isActive,
                recommended: option.recommended,
                supportSummary: option.supportSummary,
                title: option.title
              })),
              paymentStages: editableRevision.paymentStages.map((stage) => ({
                calculationType: stage.calculationType,
                description: stage.description,
                dueDays: stage.dueDays,
                fixedAmount: stage.fixedAmount?.toString() ?? null,
                id: stage.id,
                optionCode: stage.option?.code ?? null,
                percentage: stage.percentage?.toString() ?? null,
                title: stage.title,
                triggerDescription: stage.triggerDescription,
                triggerType: stage.triggerType,
                visibleToClient: stage.visibleToClient
              })),
              paymentTermsSummary: editableRevision.paymentTermsSummary,
              supportSummary: editableRevision.supportSummary,
              taxDisplayMode: editableRevision.taxDisplayMode,
              timelinePhases: editableRevision.timelinePhases.map((phase) => ({
                code: phase.code,
                dependsOnCodes: phase.dependencies.map(
                  (dependency) => dependency.dependsOnPhase.code
                ),
                deliverables: phase.deliverables.map((deliverable) => ({
                  description: deliverable.description,
                  title: deliverable.title,
                  visibleToClient: deliverable.visibleToClient
                })),
                description: phase.description,
                durationUnit: phase.durationUnit,
                durationValue: phase.durationValue,
                estimatedEndDate:
                  phase.estimatedEndDate?.toISOString().slice(0, 10) ?? null,
                estimatedStartDate:
                  phase.estimatedStartDate?.toISOString().slice(0, 10) ?? null,
                id: phase.id,
                isOptional: phase.isOptional,
                optionCode: phase.option?.code ?? null,
                title: phase.title,
                visibleToClient: phase.visibleToClient
              })),
              validUntil: editableRevision.validUntil?.toISOString().slice(0, 10) ?? null,
              warrantySummary: editableRevision.warrantySummary
            }}
            revisionId={editableRevision.id}
          />
          {markdownPanel ? (
            <section
              className={styles.renderedDocumentPanel}
              data-testid="rendered-document-panel"
            >
              <header>
                <div>
                  <p>RENDERED_DOCUMENT / SAFE_AST</p>
                  <h2>Vista editorial reutilizable.</h2>
                </div>
                <span>
                  {markdownPanel.error
                    ? "INTEGRITY_BLOCKED"
                    : "ADMIN_PREVIEW / PUBLIC_ONLY"}
                </span>
                {!markdownPanel.error ? (
                  <Link
                    className={styles.previewLink}
                    href={`/admin/propuestas/${proposal.id}/preview?revision=${editableRevision.id}`}
                  >
                    ABRIR PREVIEW FORMAL
                  </Link>
                ) : null}
              </header>
              {markdownPanel.error ? (
                <div className={styles.renderedDocumentError} role="alert">
                  <p>RENDER_INTEGRITY_ERROR</p>
                  <span>{markdownPanel.error}</span>
                </div>
              ) : markdownPanel.preview && markdownPanel.admin ? (
                <>
                  <JanvierDocumentRenderBoundary>
                    <JanvierMarkdownRenderer
                      document={markdownPanel.preview}
                      label="RENDERED_DOCUMENT"
                    />
                  </JanvierDocumentRenderBoundary>
                  <details className={styles.adminDocumentDetails}>
                    <summary>
                      ADMIN_INSPECTOR / incluye secciones internas y excluidas
                    </summary>
                    <JanvierDocumentRenderBoundary>
                      <JanvierMarkdownRenderer
                        document={markdownPanel.admin}
                        label="ADMIN_DOCUMENT"
                      />
                    </JanvierDocumentRenderBoundary>
                  </details>
                </>
              ) : null}
            </section>
          ) : null}
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
