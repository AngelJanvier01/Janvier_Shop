import { expect, test, type Page } from "@playwright/test";

type Theme = "neutral" | "night";

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("janvier-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, theme);
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("las páginas legales son públicas, renderizadas y tienen metadata canónica", async ({
  browser
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/privacidad", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Aviso de privacidad y tratamiento de datos"
  );
  await expect(page.getByTestId("legal-document")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://jaanviieer.com/privacidad"
  );
  await expect(page).toHaveTitle("Privacidad | JANVIER");

  await page.goto("/terminos", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Términos de uso");
  await expect(page.getByTestId("legal-document")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://jaanviieer.com/terminos"
  );
  await expect(page).toHaveTitle("Términos de uso | JANVIER");

  await context.close();
});

test("privacidad explica Gmail API sin exponer configuración", async ({ page }) => {
  await page.goto("/privacidad", { waitUntil: "networkidle" });
  const legalDocument = page.getByTestId("legal-document");

  await expect(legalDocument).toContainText("https://www.googleapis.com/auth/gmail.send");
  await expect(legalDocument).toContainText("no lee ni busca mensajes de Gmail");
  await expect(legalDocument).toContainText("AES-256-GCM");
  await expect(legalDocument).toContainText("janviersolutionsbusiness@gmail.com");
  await expect(legalDocument).not.toContainText("GOOGLE_OAUTH_CLIENT_ID");
  await expect(legalDocument).not.toContainText("GOOGLE_OAUTH_CLIENT_SECRET");
  await expect(legalDocument).not.toContainText("SETTINGS_ENCRYPTION_KEY");
  await expect(legalDocument).not.toContainText("NEXT_PUBLIC_");

  const copyAllowed = await legalDocument.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const event = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    selection?.removeAllRanges();
    return !event.defaultPrevented;
  });
  expect(copyAllowed).toBe(true);
});

test("footer, términos y sitemap enlazan las rutas legales", async ({
  page,
  request
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByTestId("footer-privacy")).toHaveAttribute("href", "/privacidad");
  await expect(page.getByTestId("footer-terms")).toHaveAttribute("href", "/terminos");

  await page.goto("/terminos", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("link", { name: "Aviso de privacidad y tratamiento de datos" })
  ).toHaveAttribute("href", "/privacidad");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("https://localhost:3001/privacidad");
  expect(sitemapText).toContain("https://localhost:3001/terminos");
});

for (const route of ["/privacidad", "/terminos"]) {
  test(`${route} mantiene lectura accesible en neutral y night`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
    const page = await context.newPage();

    await page.goto(route, { waitUntil: "networkidle" });
    for (const theme of ["neutral", "night"] as const) {
      await setTheme(page, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme as Theme);
      await expect(page.getByTestId("legal-table-of-contents")).toBeVisible();
      await assertNoHorizontalOverflow(page);
    }

    const indexLink = page
      .getByTestId("legal-table-of-contents")
      .getByRole("link")
      .first();
    await indexLink.focus();
    await expect(indexLink).toBeFocused();
    await context.close();
  });

  test(`${route} no desborda en móvil`, async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 }
    });
    const page = await context.newPage();

    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.getByTestId("legal-document")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await context.close();
  });
}
