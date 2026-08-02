import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";
import { persistMarkdownDraft } from "../../lib/proposals/markdown/drafts";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

const rendererSource = [
  "# Documento renderer QA",
  "",
  "## Contexto {#context type=CONTEXT}",
  "",
  "Propuesta preparada para {{client.companyName}}.",
  "",
  "| Fase | Estado |",
  "| --- | --- |",
  "| Diseño | Activo |",
  "",
  ":::janvier-internal",
  "Costo interno que nunca debe salir al cliente.",
  ":::",
  "",
  "## Nota interna {#internal type=REFERENCE internal=true}",
  "",
  "Proveedor reservado.",
  "",
  "## Alternativas {#alternatives type=ALTERNATIVES}",
  "",
  "{{proposal.options}}"
].join("\n");

test.describe("Renderer Markdown JANVIER", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test("muestra sólo contenido público, conserva el inspector y resiste tema/responsive", async ({
    browser
  }) => {
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const client = await database.client.create({
      data: {
        companyName: "Operadora Renderer QA",
        contactName: "Cliente Renderer QA",
        email: `renderer-${runId}@example.test`
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: `RENDER-${runId.toUpperCase()}`,
        title: "Renderer QA",
        status: "DRAFT"
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        proposalId: proposal.id,
        revision: 1,
        title: "Renderer QA"
      }
    });
    const parsed = parseJanvierMarkdown(rendererSource);
    expect(parsed.status).toBe("VALID");
    await persistMarkdownDraft(revision.id, owner.id, {
      expectedSourceHash: null,
      expectedVersion: null,
      originalFileName: "renderer-qa.md",
      reason: "IMPORT",
      sourceHash: parsed.sourceHash,
      sourceMarkdown: rendererSource
    });

    const session = await createAdminSession(owner.id);
    const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
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

    try {
      await page.goto(`/admin/propuestas/${proposal.id}`, { waitUntil: "networkidle" });
      const panel = page.getByTestId("rendered-document-panel");
      const preview = panel.locator('[data-mode="ADMIN_PREVIEW"]');
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("Operadora Renderer QA");
      await expect(preview).toContainText("ALTERNATIVAS_COMERCIALES");
      await expect(preview).not.toContainText(
        "Costo interno que nunca debe salir al cliente."
      );
      await expect(preview).not.toContainText("Proveedor reservado.");
      await expect(preview.getByTestId("janvier-internal")).toHaveCount(0);

      await panel
        .getByText("ADMIN_INSPECTOR / incluye secciones internas y excluidas")
        .click();
      const inspector = panel.locator('[data-mode="ADMIN"]');
      await expect(inspector).toBeVisible();
      await expect(inspector).toContainText(
        "Costo interno que nunca debe salir al cliente."
      );
      await expect(inspector).toContainText("Proveedor reservado.");
      await expect(inspector).toContainText("INT_02");

      await preview.scrollIntoViewIfNeeded();
      const initialScroll = await page.evaluate(() => window.scrollY);
      for (let index = 0; index < 50; index += 1) {
        await page.evaluate(
          (theme) => {
            window.localStorage.setItem("janvier-theme", theme);
            document.documentElement.dataset.theme = theme;
          },
          index % 2 ? "neutral" : "night"
        );
      }
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("Operadora Renderer QA");
      expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);

      await page.setViewportSize({ height: 844, width: 390 });
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(preview).toBeVisible();
    } finally {
      await context.close();
      await database.proposal.delete({ where: { id: proposal.id } });
      await database.client.delete({ where: { id: client.id } });
    }
  });
});
