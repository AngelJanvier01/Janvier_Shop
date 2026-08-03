import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { database } from "../../lib/database";
import { getProposalAssetStorage } from "../../lib/proposals/assets";
import { persistMarkdownDraft } from "../../lib/proposals/markdown/drafts";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");
test.describe("Private proposal assets", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test("carga una imagen privada, resuelve asset:alias y exige sesión para servirla", async ({
    browser
  }) => {
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const client = await database.client.create({
      data: {
        contactName: "Cliente Asset QA",
        email: `asset-${runId}@example.test`
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: `ASSET-${runId.toUpperCase()}`,
        title: "Asset QA",
        status: "DRAFT"
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        proposalId: proposal.id,
        revision: 1,
        title: "Asset QA"
      }
    });
    const source = [
      "# Asset QA",
      "",
      "## Contexto {#context type=CONTEXT}",
      "",
      "![Arquitectura del sistema](asset:architecture)"
    ].join("\n");
    const parsed = parseJanvierMarkdown(source);
    expect(parsed.status).toBe("VALID");
    await persistMarkdownDraft(revision.id, owner.id, {
      expectedSourceHash: null,
      expectedVersion: null,
      originalFileName: "asset-qa.md",
      reason: "IMPORT",
      sourceHash: parsed.sourceHash,
      sourceMarkdown: source
    });

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
    const context = await browser.newContext();
    const page = await context.newPage();
    let storageKey: string | null = null;
    const testPng = await sharp({
      create: {
        background: { alpha: 1, b: 23, g: 40, r: 52 },
        channels: 4,
        height: 2,
        width: 2
      }
    })
      .png()
      .toBuffer();

    try {
      await page.goto("/admin/acceso", { waitUntil: "networkidle" });
      await page.getByLabel("CORREO").fill(process.env.INITIAL_ADMIN_EMAIL ?? "");
      await page.getByLabel("CONTRASEÑA").fill(process.env.INITIAL_ADMIN_PASSWORD ?? "");
      await page.getByRole("button", { name: "Entrar al sistema" }).click();
      await page.waitForURL(/\/admin$/u);
      await page.goto(`/admin/propuestas/${proposal.id}`, { waitUntil: "networkidle" });
      const manager = page.getByTestId("proposal-assets-manager");
      await manager.locator('input[type="file"]').first().setInputFiles({
        buffer: testPng,
        mimeType: "image/png",
        name: "architecture.png"
      });
      await manager.getByRole("button", { name: "Cargar cola privada" }).click();
      await expect(manager).toContainText("asset:architecture");
      const preview = page.locator('[data-mode="ADMIN_PREVIEW"]');
      await expect(preview.getByTestId("janvier-asset")).toBeVisible();
      await expect(preview.getByTestId("janvier-asset").locator("img")).toHaveAttribute(
        "src",
        /\/api\/proposals\/assets\//u
      );

      const asset = await database.proposalAsset.findFirstOrThrow({
        include: { blob: true },
        where: { alias: "architecture", revisionId: revision.id }
      });
      storageKey = asset.blob.storageKey;
      const assetResponse = await page.request.get(`/api/proposals/assets/${asset.id}`);
      expect(assetResponse.status()).toBe(200);
      expect(assetResponse.headers()["content-type"]).toBe("image/png");
      expect(assetResponse.headers()["cache-control"]).toContain("private");
      expect(await assetResponse.body()).not.toHaveLength(0);

      const anonymous = await browser.newContext();
      try {
        const denied = await anonymous.request.get(
          `${baseUrl}/api/proposals/assets/${asset.id}`
        );
        expect(denied.status()).toBe(401);
      } finally {
        await anonymous.close();
      }

      await manager.getByRole("button", { name: "Retirar" }).click();
      await expect(manager).toContainText("RETIRED");
      await expect(preview.getByTestId("janvier-asset-missing")).toBeVisible();
    } finally {
      await context.close().catch(() => undefined);
      await database.proposal.delete({ where: { id: proposal.id } });
      await database.client.delete({ where: { id: client.id } });
      if (storageKey) {
        await getProposalAssetStorage()
          .delete(storageKey)
          .catch(() => undefined);
      }
      await database.proposalAssetBlob.deleteMany({
        where: { references: { none: {} } }
      });
    }
  });
});
