import { expect, test } from "@playwright/test";

import "dotenv/config";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { hashAnalyticsSession } from "../../lib/analytics/events";
import { database } from "../../lib/database";

test("registra señales públicas anonimizadas y las muestra sólo en Admin", async ({
  browser
}) => {
  const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
  const page = await context.newPage();
  let sessionHash: string | null = null;

  try {
    await page.goto("/", { waitUntil: "networkidle" });
    const heroLink = page.getByRole("link", { name: "Explorar capacidades" });
    await expect(heroLink).toBeVisible();
    await heroLink.click();
    await expect(page).toHaveURL(/\/estudio$/);

    const sessionId = await page.evaluate(() =>
      window.sessionStorage.getItem("janvier-analytics-session")
    );
    expect(sessionId).toMatch(/^[a-f0-9]{32}$/);
    const currentSessionHash = hashAnalyticsSession(sessionId ?? "");
    sessionHash = currentSessionHash;
    await expect
      .poll(() =>
        database.webAnalyticsEvent.count({
          where: {
            eventType: "CTA_CLICK",
            sessionHash: currentSessionHash,
            target: "HOME_EXPLORE"
          }
        })
      )
      .toBeGreaterThan(0);

    const owner = await database.adminUser.findFirstOrThrow({
      select: { id: true },
      where: { isActive: true }
    });
    const session = await createAdminSession(owner.id);
    const adminContext = await browser.newContext({
      viewport: { height: 900, width: 1440 }
    });
    await adminContext.addCookies([
      {
        domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
          .hostname,
        name: adminSessionCookieName,
        path: "/",
        value: session.token
      }
    ]);
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto("/admin/analitica", { waitUntil: "networkidle" });
      await expect(adminPage.getByTestId("web-analytics-report")).toBeVisible();
      await expect(adminPage.getByText("Rutas más vistas")).toBeVisible();
      await expect(adminPage.getByText("Intenciones y CTAs")).toBeVisible();
    } finally {
      await adminContext.close();
    }
  } finally {
    if (sessionHash) {
      await database.webAnalyticsEvent.deleteMany({ where: { sessionHash } });
    }
    await context.close();
  }
});
