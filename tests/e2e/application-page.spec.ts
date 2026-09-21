import { expect, test, type Page } from "@playwright/test";

type Theme = "neutral" | "night";

const sitemapBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

function sitemapUrl(path: string) {
  return new URL(path, sitemapBaseUrl).toString();
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("janvier-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, theme);
}

test("/aplicacion es pública, legible sin JavaScript y tiene metadata canónica", async ({
  browser
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  const response = await page.goto("/aplicacion", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("JANVIER");
  await expect(page).toHaveTitle("Aplicación — JANVIER");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    sitemapUrl("/aplicacion")
  );
  await expect(page.locator("main")).toContainText(
    "solicitudes, diagnósticos, proyectos y propuestas"
  );
  await expect(page.locator("main")).toContainText("sólo la utiliza para enviar avisos");
  await expect(page.locator("main")).toContainText("no accede al contenido del buzón");
  await expect(
    page.locator("main").getByRole("link", { name: "Privacidad" })
  ).toHaveAttribute("href", "/privacidad");
  await expect(
    page.locator("main").getByRole("link", { name: "Términos de uso" })
  ).toHaveAttribute("href", "/terminos");

  await context.close();
});

test("/aplicacion funciona en neutral, night y móvil", async ({ browser }) => {
  const desktopContext = await browser.newContext({
    viewport: { height: 900, width: 1440 }
  });
  const desktopPage = await desktopContext.newPage();

  await desktopPage.goto("/aplicacion", { waitUntil: "domcontentloaded" });
  for (const theme of ["neutral", "night"] as const) {
    await setTheme(desktopPage, theme);
    await expect(desktopPage.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(desktopPage.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoHorizontalOverflow(desktopPage);
  }
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 }
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("/aplicacion", { waitUntil: "domcontentloaded" });
  await expect(mobilePage.getByRole("heading", { level: 1 })).toBeVisible();
  await assertNoHorizontalOverflow(mobilePage);
  await mobileContext.close();
});

test("la portada conserva su narrativa comercial sin explicaciones OAuth", async ({
  browser
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const home = page.locator("main");
  await expect(home).toContainText("¿Qué necesitas?");
  await expect(home).toContainText("Desarrollamos, conectamos y damos soporte.");
  await expect(home).toContainText("Cuéntame qué quieres resolver.");
  await expect(home).not.toContainText(
    /Gmail API|OAuth|gmail\.send|cuenta de Google|correo/i
  );
  await expect(page.getByTestId("footer-privacy")).toHaveAttribute("href", "/privacidad");
  await expect(page.getByTestId("footer-terms")).toHaveAttribute("href", "/terminos");

  await context.close();
});

test("el sitemap público incluye /aplicacion y conserva las rutas legales", async ({
  request
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain(sitemapUrl("/aplicacion"));
  expect(sitemapText).toContain(sitemapUrl("/privacidad"));
  expect(sitemapText).toContain(sitemapUrl("/terminos"));
});
