import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

test.describe("Markdown drafts", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test("analiza, confirma, sincroniza, recupera y autoguarda una fuente DRAFT", async ({
    browser
  }) => {
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const client = await database.client.create({
      data: {
        contactName: "Cliente Markdown QA",
        email: `markdown-${runId}@example.test`
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: `MD-${runId.toUpperCase()}`,
        title: "Markdown QA",
        status: "DRAFT"
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        proposalId: proposal.id,
        revision: 1,
        title: "Markdown QA"
      }
    });
    await database.proposalSection.create({
      data: {
        content: "Bloque heredado que debe retirarse.",
        position: 1,
        revisionId: revision.id,
        title: "Bloque heredado",
        type: "CUSTOM"
      }
    });

    const session = await createAdminSession(owner.id);
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
    const source = [
      "# Documento Markdown QA",
      "",
      "## Contexto {#context type=CONTEXT}",
      "",
      "Contenido seguro y seleccionable.",
      "",
      "## Alcance {#scope type=SCOPE}",
      "",
      "- Entregable uno",
      "- Entregable dos"
    ].join("\n");

    try {
      await page.goto(`/admin/propuestas/${proposal.id}`, { waitUntil: "networkidle" });
      const studio = page.getByTestId("markdown-draft-studio");
      await studio.getByLabel("MARKDOWN / PASTE").fill(source);
      await studio.getByRole("button", { name: "Analizar Markdown" }).click();
      await expect(studio.getByText("ANALYSIS_VALID")).toBeVisible();
      await expect(studio.getByTestId("markdown-text-preview")).toContainText(
        "Documento Markdown QA"
      );
      await expect(
        database.proposalMarkdownSource.findUnique({ where: { revisionId: revision.id } })
      ).resolves.toBeNull();
      await studio.getByRole("button", { name: "Confirmar y guardar Markdown" }).click();
      await expect(
        studio.getByText("Markdown confirmado y sincronizado con la revisión.")
      ).toBeVisible();

      await expect
        .poll(async () =>
          database.proposalMarkdownSource.findUnique({
            select: { parseStatus: true, sourceHash: true, version: true },
            where: { revisionId: revision.id }
          })
        )
        .toMatchObject({ parseStatus: "VALID", version: 1 });
      const sections = await database.proposalSection.findMany({
        orderBy: { position: "asc" },
        where: { revisionId: revision.id, removedAt: null }
      });
      expect(sections.map((section) => section.sourceId)).toEqual(["context", "scope"]);
      expect(sections[0]?.contentAst).not.toBeNull();
      expect(
        await database.proposalMarkdownCheckpoint.findFirst({
          select: { reason: true },
          where: { source: { revisionId: revision.id } }
        })
      ).toMatchObject({ reason: "IMPORT" });

      const download = page.waitForEvent("download");
      await studio.getByRole("button", { name: "Descargar fuente" }).click();
      expect((await download).suggestedFilename()).toBe("pasted-markdown.md");

      const recoveredSource = `${source}\n\nRecuperado desde sessionStorage.`;
      await page.evaluate(
        ({ key, markdown }) =>
          window.sessionStorage.setItem(key, JSON.stringify({ markdown })),
        { key: `janvier:markdown-draft:${revision.id}`, markdown: recoveredSource }
      );
      await page.reload({ waitUntil: "networkidle" });
      await expect(studio.getByLabel("MARKDOWN / PASTE")).toHaveValue(recoveredSource);
      await expect(studio.getByText("RECOVERED_SESSION_DRAFT")).toBeVisible();

      const autosaveSource = `${source}\n\nActualización con autosave.`;
      await studio.getByLabel("MARKDOWN / PASTE").fill(autosaveSource);
      await expect
        .poll(async () =>
          database.proposalMarkdownSource.findUnique({
            select: { sourceMarkdown: true, version: true },
            where: { revisionId: revision.id }
          })
        )
        .toMatchObject({ sourceMarkdown: autosaveSource, version: 2 });
      await expect(
        studio.getByText("Borrador Markdown guardado automáticamente.")
      ).toBeVisible();
    } finally {
      await context.close();
      await database.proposal.delete({ where: { id: proposal.id } });
      await database.client.delete({ where: { id: client.id } });
    }
  });
});
