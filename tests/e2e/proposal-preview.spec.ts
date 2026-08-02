import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";
import { persistMarkdownDraft } from "../../lib/proposals/markdown/drafts";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

const source = [
  "# Preview formal QA",
  "",
  "Hola {{client.companyName}}.",
  "",
  "## Alcance {#scope type=SCOPE}",
  "",
  "Documento visible para cliente.",
  "",
  "{{proposal.options}}",
  "",
  "{{proposal.lineItems}}",
  "",
  "{{proposal.timeline}}",
  "",
  "{{proposal.paymentSchedule}}",
  "",
  "{{proposal.totals}}",
  "",
  ":::janvier-internal",
  "Costo privado no visible.",
  ":::"
].join("\n");

test.describe("Proposal Studio preview", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test("compone el documento público sin persistir simulaciones ni filtrar datos internos", async ({
    browser
  }) => {
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const client = await database.client.create({
      data: {
        companyName: "Operadora Preview QA",
        contactName: "Cliente Preview QA",
        email: `preview-${runId}@example.test`
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: `PREVIEW-${runId.toUpperCase()}`,
        status: "DRAFT",
        title: "Preview formal QA"
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        proposalId: proposal.id,
        revision: 1,
        title: "Preview formal QA",
        validUntil: new Date("2026-09-01T00:00:00.000Z")
      }
    });
    const option = await database.proposalOption.create({
      data: {
        code: "CORE",
        isActive: true,
        isEnabled: true,
        position: 1,
        recommended: true,
        revisionId: revision.id,
        title: "Core"
      }
    });
    await database.proposalLineItem.createMany({
      data: [
        {
          billingType: "ONE_TIME",
          code: "IMPLEMENTATION",
          description: "Configuración visible.",
          discountType: "NONE",
          discountValue: "0",
          internalCost: "600",
          isActive: true,
          isTaxable: true,
          markupPercent: "40",
          name: "Implementación",
          optionId: option.id,
          position: 1,
          pricingMode: "MARKUP",
          quantity: "1",
          revisionId: revision.id,
          scope: "OPTION_SPECIFIC",
          taxRate: "16",
          unit: "service",
          unitPrice: "1000",
          visibleForClient: true,
          visibleToClient: true
        },
        {
          billingType: "OPTIONAL",
          code: "OPTIONAL_SUPPORT",
          description: "Soporte opcional.",
          discountType: "NONE",
          discountValue: "0",
          isActive: true,
          isOptional: true,
          isTaxable: true,
          name: "Soporte opcional",
          optionId: option.id,
          position: 2,
          pricingMode: "MANUAL",
          quantity: "1",
          revisionId: revision.id,
          scope: "OPTION_SPECIFIC",
          selectedByDefault: false,
          taxRate: "16",
          unit: "month",
          unitPrice: "100",
          visibleForClient: true,
          visibleToClient: true
        }
      ]
    });
    const phase = await database.proposalTimelinePhase.create({
      data: {
        code: "DISCOVERY",
        durationUnit: "WEEK",
        durationValue: 1,
        optionId: option.id,
        position: 1,
        revisionId: revision.id,
        title: "Descubrimiento"
      }
    });
    await database.proposalTimelineDeliverable.create({
      data: { phaseId: phase.id, position: 1, title: "Diagnóstico" }
    });
    await database.proposalPaymentStage.create({
      data: {
        calculationType: "PERCENTAGE",
        optionId: option.id,
        percentage: "40",
        position: 1,
        revisionId: revision.id,
        title: "Anticipo",
        triggerType: "ACCEPTANCE"
      }
    });
    const parsed = parseJanvierMarkdown(source);
    expect(parsed.status).toBe("VALID");
    await persistMarkdownDraft(revision.id, owner.id, {
      expectedSourceHash: null,
      expectedVersion: null,
      originalFileName: "preview-qa.md",
      reason: "IMPORT",
      sourceHash: parsed.sourceHash,
      sourceMarkdown: source
    });

    const context = await browser.newContext({
      recordVideo: { dir: "artifacts/proposal-preview" },
      viewport: { height: 900, width: 1440 }
    });
    const page = await context.newPage();
    const previewUrl = `/admin/propuestas/${proposal.id}/preview?revision=${revision.id}`;
    try {
      await page.goto(previewUrl);
      await expect(page).toHaveURL(/\/admin\/acceso/);

      const session = await createAdminSession(owner.id);
      await context.addCookies([
        {
          domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
            .hostname,
          name: adminSessionCookieName,
          path: "/",
          value: session.token
        }
      ]);
      const previewResponse = await page.goto(previewUrl, { waitUntil: "networkidle" });
      expect(previewResponse?.headers()["cache-control"]).toContain("private, no-store");
      expect(previewResponse?.headers()["x-robots-tag"]).toContain("noindex");
      const preview = page.getByTestId("proposal-preview-studio");
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("DYNAMIC_PREVIEW");
      await expect(preview.getByTestId("proposal-options-comparison")).toBeVisible();
      await expect(preview.getByTestId("proposal-totals-summary")).toBeVisible();
      await expect(preview).not.toContainText("Costo privado no visible.");
      await expect(preview).not.toContainText("600");
      await page.screenshot({
        fullPage: true,
        path: "artifacts/proposal-preview/preview-desktop-neutral.png"
      });

      await page.getByRole("button", { name: "NIGHT" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
      await page.screenshot({
        fullPage: true,
        path: "artifacts/proposal-preview/preview-desktop-night.png"
      });
      const initialScroll = await page.evaluate(() => window.scrollY);
      for (let index = 0; index < 50; index += 1) {
        await page.getByRole("button", { name: index % 2 ? "NIGHT" : "NEUTRAL" }).click();
      }
      await expect(preview).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);
      await page.getByRole("button", { name: /MOBILE/ }).click();
      await expect(preview.locator('[data-device="mobile"]')).toBeVisible();
      await page.getByLabel(/PREVIEW_ONLY/).click();
      await expect(page).toHaveURL(/optional=1/);
      await expect(preview).toContainText("Soporte opcional");
      await page.getByRole("button", { name: "PANTALLA COMPLETA" }).click();
      await expect(preview).toHaveAttribute("data-presentation", "true");
      await page.getByRole("button", { name: "SALIR PRESENTACIÓN" }).click();

      await page.setViewportSize({ height: 844, width: 390 });
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await page.screenshot({
        fullPage: true,
        path: "artifacts/proposal-preview/preview-mobile-night.png"
      });
      await page.getByRole("button", { name: "NEUTRAL" }).click();
      await page.screenshot({
        fullPage: true,
        path: "artifacts/proposal-preview/preview-mobile-neutral.png"
      });
      expect(
        await database.proposal.findUniqueOrThrow({ where: { id: proposal.id } })
      ).toMatchObject({ selectedOptionId: null, status: "DRAFT" });
    } finally {
      await context.close();
      await database.proposal.delete({ where: { id: proposal.id } });
      await database.client.delete({ where: { id: client.id } });
    }
  });
});
