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
        proposalId: proposal.id,
        revision: 1,
        title: proposal.title
      }
    });
    await database.proposalSection.create({
      data: {
        content: "Alcance de verificacion de la sala privada.",
        position: 1,
        revisionId: revision.id,
        title: "Alcance de prueba",
        type: "SCOPE"
      }
    });
    await database.proposalInvite.create({
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

    await page.goto(`/propuesta/${fixture.token}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-access-form")).toBeVisible();
    await expect(page.getByText("Sistema de pruebas Project Room")).toHaveCount(0);

    const accessForm = page.getByTestId("proposal-access-form");
    await accessForm.getByLabel("CODIGO DE ACCESO").fill(fixture.accessCode);
    await accessForm.getByRole("button", { name: "Abrir propuesta" }).click();

    await expect(
      page.getByRole("heading", { name: "Sistema de pruebas Project Room" })
    ).toBeVisible();
    await expect(page.getByTestId("proposal-access-form")).toHaveCount(0);

    const decisionForm = page.getByTestId("proposal-decision-form");
    await decisionForm.getByRole("button", { name: "Solicitar ajustes" }).click();
    await decisionForm
      .getByLabel("AJUSTES NECESARIOS / REQUIRED")
      .fill("Necesitamos mover la entrega inicial a la siguiente semana.");
    await decisionForm.getByRole("button", { name: "Confirmar decision" }).click();
    await expect(
      decisionForm.getByText(
        "Solicitud de ajustes enviada. Regresaremos con una nueva revision."
      )
    ).toBeVisible();

    const persisted = await database.proposal.findUnique({
      where: { id: fixture.proposalId },
      include: { decisions: true }
    });
    expect(persisted?.status).toBe("CHANGES_REQUESTED");
    expect(persisted?.decisions).toHaveLength(1);
    expect(persisted?.decisions[0]?.type).toBe("REQUEST_CHANGES");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
