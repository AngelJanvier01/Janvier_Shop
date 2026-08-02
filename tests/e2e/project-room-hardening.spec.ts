import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";
import { createProposalInviteCredentials } from "../../lib/proposals/invite-security";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

type Fixture = {
  accessCode: string;
  clientId: string;
  inviteId: string;
  proposalId: string;
  token: string;
};

const fixtures: Fixture[] = [];
let ownerId = "";

async function createFixture(input: {
  expiresAt?: Date;
  status?: "SENT" | "VIEWED";
  title: string;
}) {
  const credentials = await createProposalInviteCredentials();
  const client = await database.client.create({
    data: {
      companyName: `QA ${input.title}`,
      contactName: "Cliente de prueba",
      email: `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${runId}@example.test`
    }
  });
  const proposal = await database.proposal.create({
    data: {
      clientId: client.id,
      ownerId,
      reference: `QA-${randomBytes(3).toString("hex").toUpperCase()}`,
      sentAt: new Date(),
      status: input.status ?? "SENT",
      title: input.title,
      validUntil: input.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  const revision = await database.proposalRevision.create({
    data: {
      authorId: ownerId,
      introduction:
        "Una revisión privada para verificar el endurecimiento del Project Room.",
      investment: "240",
      lockedAt: new Date(),
      proposalId: proposal.id,
      revision: 1,
      sharedAt: new Date(),
      taxIncluded: false,
      terms: "Vigencia y condiciones de prueba.",
      title: input.title
    }
  });
  await database.proposalSection.create({
    data: {
      content: "Contenido exacto que debe terminar en el snapshot.",
      position: 1,
      revisionId: revision.id,
      title: "Alcance",
      type: "SCOPE"
    }
  });
  const option = await database.proposalOption.create({
    data: {
      code: "BASE",
      description: "Alternativa para pruebas.",
      investment: "240",
      isEnabled: true,
      position: 1,
      recommended: true,
      revisionId: revision.id,
      title: "Implementación base"
    }
  });
  await database.proposalLineItem.create({
    data: {
      code: "PUBLIC-01",
      description: "Concepto visible para cliente.",
      discount: "10",
      internalCost: "40",
      internalNotes: "INTERNAL SECRET / jamás se muestra",
      markupPercent: "200",
      optionId: option.id,
      position: 1,
      quantity: "2",
      revisionId: revision.id,
      taxRate: "16",
      type: "ONE_TIME",
      unitPrice: "100",
      visibleForClient: true
    }
  });
  const invite = await database.proposalInvite.create({
    data: {
      codeHash: credentials.accessCodeHash,
      createdById: ownerId,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      proposalId: proposal.id,
      recipientEmail: client.email,
      revisionId: revision.id,
      tokenHash: credentials.tokenHash
    }
  });
  const fixture = {
    accessCode: credentials.accessCode,
    clientId: client.id,
    inviteId: invite.id,
    proposalId: proposal.id,
    token: credentials.token
  };
  fixtures.push(fixture);
  return fixture;
}

async function unlock(page: Page, fixture: Fixture) {
  await page.goto(`/propuesta/${fixture.token}`, { waitUntil: "networkidle" });
  const access = page.getByTestId("proposal-access-form");
  await access.getByLabel("CODIGO DE ACCESO").fill(fixture.accessCode);
  await access.getByRole("button", { name: "Abrir propuesta" }).click();
  await expect(access).toHaveCount(0);
}

test.describe("Project Room hardened", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test.beforeAll(async () => {
    const owner = await database.adminUser.findFirst({
      where: { isActive: true },
      select: { id: true }
    });
    if (!owner) throw new Error("PROJECT_ROOM_E2E requires an initialized admin user.");
    ownerId = owner.id;
  });

  test.afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await database.proposalAcceptance.deleteMany({
        where: { proposalId: fixture.proposalId }
      });
      await database.project.deleteMany({ where: { clientId: fixture.clientId } });
      await database.proposal.deleteMany({ where: { id: fixture.proposalId } });
      await database.client.deleteMany({ where: { id: fixture.clientId } });
    }
  });

  test("comienza como DRAFT desde el panel", async ({ browser }) => {
    const session = await createAdminSession(ownerId);
    const context = await browser.newContext();
    await context.addCookies([
      {
        domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001")
          .hostname,
        name: adminSessionCookieName,
        path: "/",
        value: session.token
      }
    ]);
    const page = await context.newPage();
    const title = `Borrador de prueba ${runId}`;
    await page.goto("/admin/propuestas", { waitUntil: "networkidle" });
    const form = page.locator("form").first();
    await form.getByLabel("CONTACTO / REQUIRED").fill("Ángel QA");
    await form.getByLabel("CORREO / REQUIRED").fill(`draft-${runId}@example.test`);
    await form.getByLabel("TÍTULO / REQUIRED").fill(title);
    await form
      .getByLabel("CONTEXTO Y OBJETIVO / REQUIRED")
      .fill("Contexto inicial suficiente para la propuesta de prueba.");
    await form.getByRole("button", { name: "Crear borrador" }).click();
    await expect(form.getByText("BORRADOR CREADO / AÚN NO COMPARTIDO")).toBeVisible();
    const proposal = await database.proposal.findFirst({
      where: { title },
      include: { revisions: true }
    });
    expect(proposal?.status).toBe("DRAFT");
    expect(proposal?.revisions[0]?.lockedAt).toBeNull();
    if (proposal) {
      fixtures.push({
        accessCode: "",
        clientId: proposal.clientId,
        inviteId: "",
        proposalId: proposal.id,
        token: ""
      });
    }
    await context.close();
  });

  test("exige alternativa, crea snapshot, revoca accesos y no filtra costos", async ({
    page
  }) => {
    const fixture = await createFixture({ title: `Aceptación ${runId}` });
    await unlock(page, fixture);
    expect(await page.content()).not.toContain("INTERNAL SECRET");
    expect(await page.content()).not.toContain("internalCost");

    const decision = page.getByTestId("proposal-decision-form");
    await decision.getByLabel("CARGO / REQUIRED").fill("Dirección");
    await decision
      .getByLabel("CÓDIGO DE VERIFICACIÓN / REQUIRED")
      .fill(fixture.accessCode);
    await decision.getByLabel(/Confirmo que acepto/).check();
    await decision.getByRole("button", { name: "Confirmar decision" }).click();
    await expect(
      decision.getByText("Selecciona una alternativa válida antes de aceptar.")
    ).toBeVisible();

    const selector = page.locator("form").filter({ hasText: "ALTERNATIVA ELEGIDA" });
    await selector.getByRole("radio", { name: "Implementación base" }).check();
    await selector.getByRole("button", { name: "Guardar alternativa" }).click();
    await expect(selector.getByText("Alternativa seleccionada.")).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });
    const acceptedDecision = page.getByTestId("proposal-decision-form");
    await acceptedDecision.getByLabel("CARGO / REQUIRED").fill("Dirección");
    await acceptedDecision
      .getByLabel("CÓDIGO DE VERIFICACIÓN / REQUIRED")
      .fill(fixture.accessCode);
    await acceptedDecision.getByLabel(/Confirmo que acepto/).check();
    await acceptedDecision.getByRole("button", { name: "Confirmar decision" }).click();
    await expect
      .poll(async () =>
        database.proposal.findUnique({
          where: { id: fixture.proposalId },
          select: { status: true }
        })
      )
      .toMatchObject({ status: "ACCEPTED" });

    const proposal = await database.proposal.findUnique({
      where: { id: fixture.proposalId },
      include: { acceptance: true, invites: true, project: true, revisions: true }
    });
    expect(proposal?.status).toBe("ACCEPTED");
    expect(proposal?.project?.status).toBe("DRAFT");
    expect(proposal?.acceptance?.optionId).toBe(proposal?.selectedOptionId);
    expect(proposal?.acceptance?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(proposal?.acceptance?.snapshot)).toContain("Contenido exacto");
    expect(JSON.stringify(proposal?.acceptance?.snapshot)).not.toContain(
      "INTERNAL SECRET"
    );
    expect(proposal?.invites.every((invite) => invite.status === "REVOKED")).toBe(true);
    expect(proposal?.revisions[0]?.lockedAt).not.toBeNull();

    await page.goto(`/propuesta/${fixture.token}`, { waitUntil: "networkidle" });
    const afterAccess = await database.proposal.findUnique({
      where: { id: fixture.proposalId },
      select: { acceptance: true, status: true }
    });
    expect(afterAccess?.status).toBe("ACCEPTED");
    expect(afterAccess?.acceptance).not.toBeNull();
  });

  test("un rechazo no vuelve a VIEWED al abrir la invitación", async ({ browser }) => {
    const fixture = await createFixture({ title: `Rechazo ${runId}` });
    const context = await browser.newContext();
    const page = await context.newPage();
    await unlock(page, fixture);
    const decision = page.getByTestId("proposal-decision-form");
    await decision.getByRole("button", { name: "No continuar" }).click();
    await decision.getByRole("button", { name: "Confirmar decision" }).click();
    await expect
      .poll(async () =>
        database.proposal.findUnique({
          where: { id: fixture.proposalId },
          select: { status: true }
        })
      )
      .toMatchObject({ status: "DECLINED" });
    await context.close();

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await secondPage.goto(`/propuesta/${fixture.token}`, { waitUntil: "networkidle" });
    const access = secondPage.getByTestId("proposal-access-form");
    await access.getByLabel("CODIGO DE ACCESO").fill(fixture.accessCode);
    await access.getByRole("button", { name: "Abrir propuesta" }).click();
    await expect(secondPage.getByText("PROPUESTA CERRADA")).toBeVisible();
    await expect(
      database.proposal.findUnique({
        where: { id: fixture.proposalId },
        select: { status: true }
      })
    ).resolves.toMatchObject({ status: "DECLINED" });
    await secondContext.close();
  });

  test("aísla tokens, rechaza vencidas/revocadas y bloquea cinco intentos", async ({
    browser
  }) => {
    const clientA = await createFixture({ title: `Cliente A ${runId}` });
    const clientB = await createFixture({ title: `Cliente B ${runId}` });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/propuesta/${clientB.token}`, { waitUntil: "networkidle" });
    const accessB = page.getByTestId("proposal-access-form");
    await accessB.getByLabel("CODIGO DE ACCESO").fill(clientA.accessCode);
    await accessB.getByRole("button", { name: "Abrir propuesta" }).click();
    await expect(accessB.getByRole("alert")).toContainText("No pudimos validar");
    await expect(page.getByText(`Cliente B ${runId}`)).toHaveCount(0);

    const exhausted = await createFixture({ title: `Bloqueo ${runId}` });
    await page.goto(`/propuesta/${exhausted.token}`, { waitUntil: "networkidle" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) {
        await page.reload({ waitUntil: "networkidle" });
      }
      const attemptAccess = page.getByTestId("proposal-access-form");
      await attemptAccess.getByLabel("CODIGO DE ACCESO").fill("ZZZZ-ZZZZ");
      await attemptAccess.getByRole("button", { name: "Abrir propuesta" }).click();
      await expect
        .poll(() =>
          database.proposalInviteAttempt.count({
            where: { inviteId: exhausted.inviteId }
          })
        )
        .toBe(attempt + 1);
    }
    await page.reload({ waitUntil: "networkidle" });
    const lockedAccess = page.getByTestId("proposal-access-form");
    await lockedAccess.getByLabel("CODIGO DE ACCESO").fill("ZZZZ-ZZZZ");
    await lockedAccess.getByRole("button", { name: "Abrir propuesta" }).click();
    await expect(lockedAccess.getByRole("alert")).toContainText("Por seguridad");

    const expired = await createFixture({
      expiresAt: new Date(Date.now() - 1000),
      title: `Vencida ${runId}`
    });
    await page.goto(`/propuesta/${expired.token}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-access-form")).toHaveCount(0);

    const revoked = await createFixture({ title: `Revocada ${runId}` });
    await database.proposalInvite.update({
      where: { id: revoked.inviteId },
      data: { revokedAt: new Date(), status: "REVOKED" }
    });
    await page.goto(`/propuesta/${revoked.token}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-access-form")).toHaveCount(0);
    await context.close();
  });

  test("rotar una invitacion invalida el token anterior", async ({ browser }) => {
    const fixture = await createFixture({ title: `Rotacion ${runId}` });
    const replacement = await createProposalInviteCredentials();
    const now = new Date();
    const revision = await database.proposalRevision.findFirstOrThrow({
      where: { proposalId: fixture.proposalId },
      select: { id: true }
    });

    await database.$transaction([
      database.proposalInvite.update({
        where: { id: fixture.inviteId },
        data: { revokedAt: now, status: "REVOKED" }
      }),
      database.proposalInvite.create({
        data: {
          codeHash: replacement.accessCodeHash,
          createdById: ownerId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          proposalId: fixture.proposalId,
          recipientEmail: `rotacion-${runId}@example.test`,
          revisionId: revision.id,
          tokenHash: replacement.tokenHash
        }
      })
    ]);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/propuesta/${fixture.token}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("proposal-access-form")).toHaveCount(0);

    await page.goto(`/propuesta/${replacement.token}`, { waitUntil: "networkidle" });
    const access = page.getByTestId("proposal-access-form");
    await access.getByLabel("CODIGO DE ACCESO").fill(replacement.accessCode);
    await access.getByRole("button", { name: "Abrir propuesta" }).click();
    await expect(access).toHaveCount(0);
    await context.close();
  });
});
