import { expect, test, type Page } from "@playwright/test";

type Theme = "neutral" | "night";

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("janvier-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, theme);
}

for (const viewport of [
  { label: "desktop", viewport: { height: 900, width: 1440 } },
  { label: "móvil", viewport: { height: 844, width: 390 } }
]) {
  test(`ADMIN_ACCESS funciona con teclado en footer ${viewport.label}`, async ({
    browser
  }) => {
    const context = await browser.newContext({ viewport: viewport.viewport });
    const page = await context.newPage();

    for (const theme of ["neutral", "night"] as const) {
      await page.goto("/", { waitUntil: "networkidle" });
      await setTheme(page, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      const link = page.getByTestId("footer-admin-access");
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/admin/acceso");

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

      await link.focus();
      await expect(link).toBeFocused();
      await Promise.all([page.waitForURL(/\/admin\/acceso$/), link.press("Enter")]);
      await expect(page).toHaveURL(/\/admin\/acceso$/);
    }

    await context.close();
  });
}

test("la identidad pública usa Angel Janvier y ZACATECAS_MX", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("ZACATECAS_MX / REMOTE_WORLDWIDE").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("MONTERREY_MX");
  await expect(page.locator("body")).toContainText("Soy Angel Janvier.");
  await expect(page.locator("body")).not.toContainText("Ángel Janvier");

  await page.goto("/acerca", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toContainText("Angel Janvier");
  await expect(page.locator("body")).not.toContainText("Ángel Janvier");
});
