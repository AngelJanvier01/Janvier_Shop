import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";
import { persistMarkdownDraft } from "../../lib/proposals/markdown/drafts";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

const enabled = process.env.PROJECT_ROOM_E2E === "1";
const runId = randomBytes(5).toString("hex");

test.describe("Commercial proposal engine", () => {
  test.skip(!enabled, "Requiere PostgreSQL local y PROJECT_ROOM_E2E=1.");

  test("renderiza alternativas, conceptos, cronograma y pagos sin datos internos", async ({
    browser
  }) => {
    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const client = await database.client.create({
      data: {
        contactName: "Cliente Commercial QA",
        email: `commercial-${runId}@example.test`
      }
    });
    const proposal = await database.proposal.create({
      data: {
        clientId: client.id,
        ownerId: owner.id,
        reference: `COMMERCIAL-${runId.toUpperCase()}`,
        title: "Commercial QA",
        status: "DRAFT"
      }
    });
    const revision = await database.proposalRevision.create({
      data: {
        authorId: owner.id,
        proposalId: proposal.id,
        revision: 1,
        title: "Commercial QA"
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
    await database.proposalLineItem.create({
      data: {
        billingType: "ONE_TIME",
        code: "IMPLEMENTATION",
        description: "Configuración y puesta en marcha.",
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
      }
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
      data: {
        phaseId: phase.id,
        position: 1,
        title: "Diagnóstico"
      }
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
    const source = [
      "# Commercial QA",
      "",
      "{{proposal.options}}",
      "",
      "{{proposal.lineItems}}",
      "",
      "{{proposal.timeline}}",
      "",
      "{{proposal.paymentSchedule}}",
      "",
      "{{proposal.totals}}"
    ].join("\n");
    const parsed = parseJanvierMarkdown(source);
    expect(parsed.status).toBe("VALID");
    await persistMarkdownDraft(revision.id, owner.id, {
      expectedSourceHash: null,
      expectedVersion: null,
      originalFileName: "commercial-qa.md",
      reason: "IMPORT",
      sourceHash: parsed.sourceHash,
      sourceMarkdown: source
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
      await page.goto(`/admin/propuestas/${proposal.id}`, { waitUntil: "networkidle" });
      const studio = page.getByTestId("proposal-commercial-studio");
      await expect(studio).toBeVisible();
      const preview = page.locator('[data-mode="ADMIN_PREVIEW"]');
      await expect(preview.getByTestId("proposal-options-comparison")).toBeVisible();
      await expect(preview.getByTestId("proposal-line-items-table")).toContainText(
        "Implementación"
      );
      await expect(preview.getByTestId("proposal-timeline")).toContainText("Diagnóstico");
      await expect(preview.getByTestId("proposal-payment-schedule")).toContainText(
        "Anticipo"
      );
      await expect(preview).not.toContainText("600");
      await expect(preview).not.toContainText("40%");

      await page.setViewportSize({ height: 844, width: 390 });
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(preview.getByTestId("proposal-totals-summary")).toBeVisible();
    } finally {
      await context.close();
      await database.proposal.delete({ where: { id: proposal.id } });
      await database.client.delete({ where: { id: client.id } });
    }
  });
});
