import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";

const enabled = process.env.DIAGNOSTIC_E2E === "1";

test.describe("Diagnostic request pipeline", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y DIAGNOSTIC_E2E=1.");

  test("califica una solicitud y crea un borrador vinculado", async ({ browser }) => {
    const suffix = randomBytes(5).toString("hex");
    const email = `diagnostic-${suffix}@example.test`;
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const request = await database.diagnosticRequest.create({
      data: {
        companyName: "Operación Diagnóstico QA",
        contactName: "Andrea Diagnóstico",
        email,
        message: "Necesitamos ordenar la captura operativa y reducir el trabajo manual.",
        service: "Software y automatización",
        timeline: "Este trimestre"
      }
    });
    const session = await createAdminSession(owner.id);
    const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
    await context.addCookies([
      {
        domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
          .hostname,
        name: adminSessionCookieName,
        path: "/",
        value: session.token
      }
    ]);
    const page = await context.newPage();

    try {
      await page.goto("/admin/diagnosticos", { waitUntil: "networkidle" });
      const card = page.getByTestId(`diagnostic-request-${request.id}`);
      await expect(card).toBeVisible();
      await expect(card).toContainText("Operación Diagnóstico QA");

      await card.getByLabel("ESTADO").selectOption("QUALIFIED");
      await card.getByLabel("NOTAS INTERNAS").fill("Prioridad alta; validar alcance.");
      await card.getByRole("button", { name: "Guardar seguimiento" }).click();
      await expect(card).toContainText("Solicitud actualizada.");
      await expect
        .poll(() =>
          database.diagnosticRequest.findUniqueOrThrow({ where: { id: request.id } })
        )
        .toMatchObject({
          privateNotes: "Prioridad alta; validar alcance.",
          status: "QUALIFIED"
        });

      await card.getByRole("button", { name: "Crear propuesta" }).click();
      await expect(card).toContainText("Borrador creado desde el diagnóstico.");
      const proposalLink = card.getByRole("link", { name: "Abrir borrador vinculado" });
      await expect(proposalLink).toBeVisible();
      await proposalLink.click();
      await expect(page).toHaveURL(/\/admin\/propuestas\//);

      const linkedRequest = await database.diagnosticRequest.findUniqueOrThrow({
        include: { proposal: { include: { revisions: true } } },
        where: { id: request.id }
      });
      expect(linkedRequest.status).toBe("PROPOSAL");
      expect(linkedRequest.proposal?.clientId).toBeTruthy();
      expect(linkedRequest.proposal?.revisions).toHaveLength(1);
      expect(linkedRequest.proposal?.revisions[0]?.introduction).toContain(
        "reducir el trabajo manual"
      );
    } finally {
      await context.close();
      const current = await database.diagnosticRequest.findUnique({
        select: { clientId: true, proposalId: true },
        where: { id: request.id }
      });
      if (current?.proposalId) {
        await database.proposal.delete({ where: { id: current.proposalId } });
      }
      await database.diagnosticRequest.deleteMany({ where: { id: request.id } });
      if (current?.clientId) {
        await database.client.deleteMany({ where: { id: current.clientId, email } });
      }
    }
  });
});
