import { notFound } from "next/navigation";

import { ProposalPreviewStudio } from "@/components/admin/proposal-preview-studio";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  getProposalAssetManifest,
  getProposalMarkdownAssetReport,
  publicAssetManifest
} from "@/lib/proposals/assets";
import { buildPublicProposalCommercialDto } from "@/lib/proposals/commercial-dto";
import {
  buildPublicJanvierDocument,
  janvierDocumentSchema,
  parseJanvierMarkdown
} from "@/lib/proposals/markdown";
import { buildProposalPreviewModel } from "@/lib/proposals/preview";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { follow: false, index: false },
  title: "Vista previa de propuesta"
};

type PreviewPageProps = {
  params: Promise<{ proposalId: string }>;
  searchParams: Promise<{ option?: string; optional?: string; revision?: string }>;
};

function documentDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: process.env.JANVIER_TIMEZONE ?? "America/Mexico_City"
  }).format(value);
}

export default async function ProposalPreviewPage({
  params,
  searchParams
}: PreviewPageProps) {
  await requireCurrentAdmin();
  const [{ proposalId }, query] = await Promise.all([params, searchParams]);
  const proposal = await database.proposal.findUnique({
    include: {
      client: { select: { companyName: true, contactName: true, email: true } },
      owner: { select: { name: true } },
      revisions: {
        include: {
          lineItems: {
            include: { option: { select: { code: true } } },
            orderBy: { position: "asc" }
          },
          markdownSource: true,
          options: { orderBy: { position: "asc" } },
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
    },
    where: { id: proposalId }
  });
  if (!proposal) {
    notFound();
  }

  const revision =
    proposal.revisions.find((candidate) => candidate.id === query.revision) ??
    proposal.revisions.find((candidate) => !candidate.lockedAt) ??
    proposal.revisions[0];
  if (!revision?.markdownSource) {
    return (
      <main className="systemPage">
        <p className="systemPageEyebrow">ADMIN_PREVIEW / SOURCE_REQUIRED</p>
        <h1>Esta revisión aún no tiene un documento Markdown válido.</h1>
        <p className="systemPageCopy">
          Importa o repara la fuente antes de abrir una vista previa formal.
        </p>
      </main>
    );
  }

  const stored = janvierDocumentSchema.safeParse(revision.markdownSource.normalizedAst);
  const reparsed = stored.success
    ? null
    : parseJanvierMarkdown(revision.markdownSource.sourceMarkdown);
  const sourceDocument = stored.success ? stored.data : reparsed?.document;
  if (!sourceDocument || reparsed?.status === "ERROR") {
    return (
      <main className="systemPage">
        <p className="systemPageEyebrow">ADMIN_PREVIEW / INTEGRITY_BLOCKED</p>
        <h1>La fuente no puede representarse de forma segura.</h1>
        <p className="systemPageCopy">
          El editor debe resolver los diagnósticos Markdown antes de continuar.
        </p>
      </main>
    );
  }

  const requestedOption = revision.options.find(
    (option) => option.isActive && option.code === query.option
  );
  const selectedOption =
    requestedOption ??
    revision.options.find((option) => option.isActive && option.recommended) ??
    revision.options.find((option) => option.isActive) ??
    null;
  const commercial = buildPublicProposalCommercialDto(
    {
      commercialCalculationVersion: revision.commercialCalculationVersion,
      currency: revision.currency,
      deliveryTerms: revision.deliveryTerms,
      lineItems: revision.lineItems.map((lineItem) => ({
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
      options: revision.options.map((option) => ({
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
      paymentStages: revision.paymentStages.map((stage) => ({
        calculationType: stage.calculationType,
        description: stage.description,
        dueDays: stage.dueDays,
        fixedAmount: stage.fixedAmount,
        id: stage.id,
        option: stage.option,
        optionId: stage.optionId,
        percentage: stage.percentage,
        position: stage.position,
        title: stage.title,
        triggerDescription: stage.triggerDescription,
        triggerType: stage.triggerType,
        visibleToClient: stage.visibleToClient
      })),
      paymentTermsSummary: revision.paymentTermsSummary,
      supportSummary: revision.supportSummary,
      timelinePhases: revision.timelinePhases,
      validUntil: revision.validUntil,
      warrantySummary: revision.warrantySummary
    },
    {
      includeOptional: query.optional === "1",
      selectedOptionId: selectedOption?.id
    }
  );
  const [assetManifest, assetReport] = await Promise.all([
    getProposalAssetManifest(revision.id, true),
    getProposalMarkdownAssetReport(revision.id, sourceDocument)
  ]);
  const publicDocument = buildPublicJanvierDocument(sourceDocument, {
    assetManifest: publicAssetManifest(assetManifest),
    commercial,
    mode: "ADMIN_PREVIEW",
    removedSectionSourceIds: new Set(
      revision.sections
        .filter((section) => section.removedAt)
        .map((section) => section.sourceId)
    ),
    selectedAlternativeCode: selectedOption?.code,
    variableContext: {
      author: { name: proposal.owner.name },
      client: proposal.client,
      currentDate: documentDate(new Date()),
      proposal: {
        currency: commercial.currency,
        deliveryTerms: commercial.terms.deliveryTerms,
        paymentTermsSummary: commercial.terms.paymentTermsSummary,
        reference: proposal.reference,
        supportSummary: commercial.terms.supportSummary,
        title: proposal.title,
        validUntil: commercial.terms.validUntil
          ? documentDate(new Date(commercial.terms.validUntil))
          : null,
        warrantySummary: commercial.terms.warrantySummary
      }
    }
  });
  const model = buildProposalPreviewModel({
    assetReport,
    commercial,
    document: sourceDocument,
    proposal: { id: proposal.id, reference: proposal.reference, status: proposal.status },
    publicDocument,
    revision: {
      commercialVersion: revision.commercialVersion,
      id: revision.id,
      markdownVersion: revision.markdownSource.version,
      number: revision.revision,
      title: revision.title
    }
  });

  return (
    <ProposalPreviewStudio
      includeOptional={query.optional === "1"}
      isLocked={Boolean(revision.lockedAt)}
      model={model}
      revisions={proposal.revisions.map((candidate) => ({
        id: candidate.id,
        number: candidate.revision,
        title: candidate.title
      }))}
      selectedOptionCode={selectedOption?.code ?? null}
    />
  );
}
