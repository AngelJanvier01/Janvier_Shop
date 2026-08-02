import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { database } from "../../lib/database";
import { createProposalInviteCredentials } from "../../lib/proposals/invite-security";

const runProjectRoomE2E = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

type Fixture = {
  accessCode: string;
  clientId: string;
  inviteId: string;
  proposalId: string;
  token: string;
};

let fixture: Fixture | undefined;

test.describe("Project Room", () => {
  test.skip(!runProjectRoomE2E, "Requiere una base local efimera de Project Room.");

  test.beforeAll(async () => {
    const owner = await database.adminUser.findFirst({
      where: { isActive: true },
      select: { id: true }
    });
    if (!owner) {
      throw new Error("PROJECT_ROOM_E2E requires an initialized admin user.");
    }

    const credentials = await createProposalInviteCredentials();
    const client = await database.client.create({
      data: {
        companyName: `QA Project Room ${runId}`,
        contactName: "Cliente de prueba",
        email: `project-room-${runId}@example.test`
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: `QA-${runId.toUpperCase()}`,
        sentAt: new Date(),
        status: "SENT",
        title: "Sistema de pruebas Project Room"
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        introduction:
          "Esta propuesta verifica el acceso privado y la decision del cliente.",
        investment: 48000,
        proposalId: proposal.id,
        revision: 1,
        taxIncluded: true,
        terms: "La propuesta requiere una persona de enlace y una revisión semanal.",
        title: proposal.title
      }
    });
    await database.proposalSection.createMany({
      data: [
        {
          content: "Alcance de verificacion de la sala privada.",
          position: 1,
          revisionId: revision.id,
          title: "Alcance de prueba",
          type: "SCOPE"
        },
        {
          content: "Un prototipo verificable y una sesión de transferencia.",
          position: 2,
          revisionId: revision.id,
          title: "Entregables de prueba",
          type: "DELIVERABLES"
        }
      ]
    });
    await database.proposalOption.create({
      data: {
        code: "QA-BASE",
        description: "Alternativa recomendada para validar la experiencia.",
        investment: 48000,
        position: 1,
        recommended: true,
        revisionId: revision.id,
        taxIncluded: true,
        title: "Implementación base"
      }
    });
    const invite = await database.proposalInvite.create({
      data: {
        codeHash: credentials.accessCodeHash,
        createdById: owner.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        proposalId: proposal.id,
        recipientEmail: client.email,
        revisionId: revision.id,
        tokenHash: credentials.tokenHash
      }
    });
    fixture = {
      accessCode: credentials.accessCode,
      clientId: client.id,
      inviteId: invite.id,
      proposalId: proposal.id,
      token: credentials.token
    };
  });

  test.afterAll(async () => {
    if (!fixture) {
      return;
    }
    await database.proposal.delete({ where: { id: fixture.proposalId } });
    await database.client.delete({ where: { id: fixture.clientId } });
  });

  test("protege, abre y registra la decision de una propuesta", async ({ page }) => {
    if (!fixture) {
      throw new Error("Project Room fixture is unavailable.");
    }
    const proposalId = fixture.proposalId;

    const response = await page.goto(`/propuesta/${fixture.token}`, {
      waitUntil: "networkidle"
    });
    const cacheControl = response?.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("no-cache");
    if (process.env.PLAYWRIGHT_MODE === "production") {
      expect(cacheControl).toContain("no-store");
    }
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByTestId("proposal-access-form")).toBeVisible();
    await expect(page.getByText("Sistema de pruebas Project Room")).toHaveCount(0);

    const accessForm = page.getByTestId("proposal-access-form");
    await accessForm.getByLabel("CODIGO DE ACCESO").fill("ZZZZ-ZZZZ");
    await accessForm.getByRole("button", { name: "Abrir propuesta" }).click();
    await expect(accessForm.getByRole("alert")).toContainText("No pudimos validar");
    await accessForm.getByLabel("CODIGO DE ACCESO").fill(fixture.accessCode);
    await accessForm.getByRole("button", { name: "Abrir propuesta" }).click();

    await expect(
      page.getByRole("heading", { name: "Sistema de pruebas Project Room" })
    ).toBeVisible();
    await expect(page.getByText("ENTREGABLES", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Implementación base" })
    ).toBeVisible();
    await expect(page.getByText("Impuestos incluidos").first()).toBeVisible();
    await expect(
      page.getByText(
        "La propuesta requiere una persona de enlace y una revisión semanal."
      )
    ).toBeVisible();
    await expect(page.getByTestId("proposal-access-form")).toHaveCount(0);

    const decisionForm = page.getByTestId("proposal-decision-form");
    await decisionForm.getByRole("button", { name: "Solicitar ajustes" }).click();
    await decisionForm
      .getByLabel("AJUSTES NECESARIOS / REQUIRED")
      .fill("Necesitamos mover la entrega inicial a la siguiente semana.");
    await decisionForm.getByRole("button", { name: "Confirmar decision" }).click();
    await expect
      .poll(async () =>
        database.proposal.findUnique({
          where: { id: proposalId },
          select: { status: true }
        })
      )
      .toMatchObject({ status: "CHANGES_REQUESTED" });

    const persisted = await database.proposal.findUnique({
      where: { id: fixture.proposalId },
      include: { decisions: true }
    });
    expect(persisted?.status).toBe("CHANGES_REQUESTED");
    expect(persisted?.decisions).toHaveLength(1);
    expect(persisted?.decisions[0]?.type).toBe("REQUEST_CHANGES");
    await expect(
      database.proposalInviteAttempt.count({ where: { inviteId: fixture.inviteId } })
    ).resolves.toBe(0);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
