import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { database } from "../../lib/database";
import { createProposalInviteCredentials } from "../../lib/proposals/invite-security";
import {
  buildFrozenProposalEvidence,
  buildPublicJanvierDocument,
  parseJanvierMarkdown
} from "../../lib/proposals/markdown";
import { publicProposalCommercialSchema } from "../../lib/proposals/commercial-dto";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

test.describe("Markdown proposal freeze", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test("Project Room y aceptación usan el paquete congelado, no datos vivos", async ({
    page
  }) => {
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const credentials = await createProposalInviteCredentials();
    const validUntil = new Date(Date.now() + 60 * 60 * 1000);
    const optionId = `frozen-option-${runId}`;
    const commercial = publicProposalCommercialSchema.parse({
      alternatives: [
        {
          annual: { discount: "0", subtotal: "0", tax: "0", total: "0" },
          code: "BASE",
          conditionsSummary: null,
          description: "Alternativa congelada para la verificación de release.",
          estimatedDuration: null,
          id: optionId,
          lineItems: [],
          monthly: { discount: "0", subtotal: "0", tax: "0", total: "0" },
          oneTime: { discount: "0", subtotal: "100", tax: "16", total: "116" },
          optional: { discount: "0", subtotal: "0", tax: "0", total: "0" },
          recommended: true,
          supportSummary: null,
          title: "Implementación congelada"
        }
      ],
      calculationVersion: "janvier-commercial-v1",
      currency: "MXN",
      lineItems: [],
      paymentSchedule: [],
      terms: {
        deliveryTerms: null,
        paymentTermsSummary: "Condiciones congeladas.",
        supportSummary: null,
        validUntil: validUntil.toISOString().slice(0, 10),
        warrantySummary: null
      },
      timeline: []
    });
    const source = [
      "# Propuesta congelada",
      "",
      "## Alcance {#scope type=SCOPE}",
      "",
      "Preparado para {{client.contactName}}.",
      "",
      ":::janvier-internal",
      "Nota interna que nunca debe aparecer en Project Room.",
      ":::"
    ].join("\n");
    const parsed = parseJanvierMarkdown(source);
    expect(parsed.status).toBe("VALID");
    const variables = {
      client: {
        companyName: "Cliente congelado S.A.",
        contactName: "Contacto congelado",
        email: `frozen-${runId}@example.test`
      },
      currentDate: "2 de agosto de 2026",
      proposal: {
        currency: "MXN",
        reference: `FREEZE-${runId.toUpperCase()}`,
        title: "Propuesta congelada",
        validUntil: "2 de agosto de 2026"
      }
    };
    const publicDocument = buildPublicJanvierDocument(parsed.document, {
      commercial,
      mode: "CLIENT",
      variableContext: variables
    });
    const evidence = buildFrozenProposalEvidence({
      fullAssetManifest: [],
      generation: { generatedAt: "2026-08-02T00:00:00.000Z", rendererVersion: "qa" },
      normalizedAst: parsed.document,
      parserVersion: parsed.parserVersion,
      privateDocument: {
        internal: "Nota interna que nunca debe aparecer en Project Room."
      },
      publicDocument,
      publicFacts: {
        alternative: null,
        commercial,
        currency: "MXN",
        revision: 1,
        validUntil: validUntil.toISOString()
      },
      resolvedVariables: variables,
      sourceHash: parsed.sourceHash,
      sourceMarkdown: source
    });
    const client = await database.client.create({
      data: {
        companyName: "Cliente congelado S.A.",
        contactName: "Contacto congelado",
        email: variables.client.email
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: variables.proposal.reference,
        sentAt: new Date(),
        status: "SENT",
        title: "Propuesta congelada",
        validUntil
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        evidenceHash: evidence.evidenceHash,
        frozenAt: new Date(),
        frozenPrivateEvidence: JSON.parse(JSON.stringify(evidence.privateEvidence)),
        frozenPublicDocument: {
          commercial,
          document: publicDocument,
          publicContentHash: evidence.publicContentHash,
          resolvedVariables: variables,
          revision: 1,
          validUntil: validUntil.toISOString(),
          version: "markdown-first-v1"
        },
        lockedAt: new Date(),
        proposalId: proposal.id,
        publicContentHash: evidence.publicContentHash,
        resolvedVariables: variables,
        revision: 1,
        sharedAt: new Date(),
        title: "Propuesta congelada"
      }
    });
    await database.proposalOption.create({
      data: {
        code: "BASE",
        id: optionId,
        isActive: true,
        isEnabled: true,
        position: 1,
        recommended: true,
        revisionId: revision.id,
        title: "Implementación congelada"
      }
    });
    await database.proposalInvite.create({
      data: {
        codeHash: credentials.accessCodeHash,
        createdById: owner.id,
        expiresAt: validUntil,
        proposalId: proposal.id,
        recipientEmail: client.email,
        revisionId: revision.id,
        tokenHash: credentials.tokenHash
      }
    });

    try {
      await page.goto(`/propuesta/${credentials.token}`, { waitUntil: "networkidle" });
      const access = page.getByTestId("proposal-access-form");
      await access.getByLabel("TU NOMBRE").fill("Contacto congelado");
      await access.getByLabel("CÓDIGO DE ACCESO").fill(credentials.accessCode);
      await access.getByRole("button", { name: "Abrir propuesta" }).click();
      await expect(page.getByTestId("frozen-project-room")).toBeVisible();
      await expect(page.getByTestId("frozen-project-room")).toContainText(
        "Contacto congelado"
      );
      await expect(page.getByTestId("frozen-project-room")).not.toContainText(
        "Nota interna que nunca debe aparecer"
      );

      await database.client.update({
        data: { contactName: "Contacto modificado después de compartir" },
        where: { id: client.id }
      });
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByTestId("frozen-project-room")).toContainText(
        "Contacto congelado"
      );
      await expect(page.getByTestId("frozen-project-room")).not.toContainText(
        "Contacto modificado después de compartir"
      );

      const selector = page.locator("form").filter({ hasText: "ALTERNATIVA ELEGIDA" });
      await selector.getByRole("radio", { name: "Implementación congelada" }).check();
      await expect(selector.locator('input[name="optionId"]')).toHaveValue(optionId);
      await expect(
        selector.getByRole("button", { name: "Guardar alternativa" })
      ).toBeEnabled();
      await selector.getByRole("button", { name: "Guardar alternativa" }).click();
      await page.reload({ waitUntil: "networkidle" });
      const decision = page.getByTestId("proposal-decision-form");
      await decision.getByLabel("CARGO / REQUIRED").fill("Dirección");
      await decision
        .getByLabel(/DIGO.*VERIFICACI.*REQUIRED/)
        .fill(credentials.accessCode);
      await decision.getByLabel(/Confirmo que acepto/).check();
      await decision.getByRole("button", { name: "Confirmar decision" }).click();
      await expect
        .poll(async () =>
          database.proposalAcceptance.findUnique({
            where: { proposalId: proposal.id },
            select: { evidenceHash: true, publicContentHash: true, snapshotVersion: true }
          })
        )
        .toMatchObject({
          evidenceHash: evidence.evidenceHash,
          publicContentHash: evidence.publicContentHash,
          snapshotVersion: "markdown-first-v1"
        });
    } finally {
      const currentProposal = await database.proposal.findUnique({
        select: { projectId: true },
        where: { id: proposal.id }
      });
      await database.proposalAcceptance.deleteMany({
        where: { proposalId: proposal.id }
      });
      await database.proposal.delete({ where: { id: proposal.id } });
      if (currentProposal?.projectId) {
        await database.project.delete({ where: { id: currentProposal.projectId } });
      }
      await database.client.delete({ where: { id: client.id } });
    }
  });
});
