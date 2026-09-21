import { expect, test } from "@playwright/test";

import "dotenv/config";

import { database } from "../../lib/database";
import { collectConsoleProblems } from "./support/console";

const staticPublicRoutes = [
  "/",
  "/acerca",
  "/aplicacion",
  "/contacto",
  "/diagnostico",
  "/estudio",
  "/laboratorio",
  "/privacidad",
  "/proyectos",
  "/soluciones",
  "/suministro",
  "/suministro/catalogo",
  "/terminos"
];

test("las rutas públicas tienen identidad, metadata y semántica de lanzamiento", async ({
  page
}) => {
  test.setTimeout(120_000);
  const [project, product] = await Promise.all([
    database.project.findFirst({ select: { slug: true }, where: { isPublic: true } }),
    database.product.findFirst({
      select: { slug: true },
      where: { status: "PUBLISHED" }
    })
  ]);
  const routes = [
    ...staticPublicRoutes,
    ...(project ? [`/proyectos/${project.slug}`] : []),
    ...(product ? [`/suministro/catalogo/${product.slug}`] : [])
  ];
  const titles = new Set<string>();
  const consoleProblems = collectConsoleProblems(page);
  const failedResources: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  });
  const expectedOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002"
  ).origin;

  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status(), route).toBe(200);

    const title = await page.title();
    expect(title.length, `${route}: title`).toBeGreaterThan(8);
    expect(titles.has(title), `${route}: title duplicado (${title})`).toBe(false);
    titles.add(title);

    await expect(page.locator("h1"), `${route}: debe existir un solo H1`).toHaveCount(1);
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description?.trim().length, `${route}: description`).toBeGreaterThan(50);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical, `${route}: canonical`).toBeTruthy();
    const canonicalUrl = new URL(canonical!);
    expect(canonicalUrl.origin, `${route}: origen canonical`).toBe(expectedOrigin);
    expect(canonicalUrl.pathname, `${route}: ruta canonical`).toBe(route);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /JANVIER/
    );
    const socialDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content");
    expect(socialDescription?.trim().length, `${route}: og:description`).toBeGreaterThan(
      50
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https?:\/\//
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );

    const pageState = await page.evaluate(() => ({
      emptyLinks: Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href]")
      ).filter((link) => !link.getAttribute("href")?.trim()).length,
      imagesWithoutAlt: Array.from(document.images).filter(
        (image) => !image.hasAttribute("alt")
      ).length,
      unsafeBlankLinks: Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')
      ).filter((link) => !link.rel.split(/\s+/).includes("noreferrer")).length,
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    expect(pageState.emptyLinks, `${route}: enlaces vacíos`).toBe(0);
    expect(pageState.imagesWithoutAlt, `${route}: imágenes sin alt`).toBe(0);
    expect(pageState.unsafeBlankLinks, `${route}: enlaces externos inseguros`).toBe(0);
    expect(pageState.overflow, `${route}: overflow horizontal`).toBeLessThanOrEqual(1);
  }

  expect(failedResources).toEqual([]);
  expect(consoleProblems).toEqual([]);
});

test("los enlaces internos publicos no estan rotos", async ({ page, request }) => {
  test.setTimeout(120_000);
  const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002");
  const paths = new Set<string>();

  for (const route of staticPublicRoutes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));

    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== baseUrl.origin) continue;
      url.hash = "";
      paths.add(`${url.pathname}${url.search}`);
    }
  }

  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBeLessThan(400);
  }
});

test("robots, sitemap, manifest e imágenes sociales responden correctamente", async ({
  request
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  await expect(robots.text()).resolves.toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  for (const route of staticPublicRoutes) {
    expect(sitemapText, route).toContain(route === "/" ? "<loc>" : route);
  }
  expect(sitemapText).not.toContain("/admin");
  expect(sitemapText).not.toContain("/propuesta/");

  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  expect(await manifest.json()).toMatchObject({ lang: "es-MX", name: "JANVIER" });

  for (const route of ["/opengraph-image", "/twitter-image"]) {
    const image = await request.get(route);
    expect(image.status(), route).toBe(200);
    expect(image.headers()["content-type"], route).toContain("image/png");
    expect((await image.body()).byteLength, route).toBeGreaterThan(10_000);
  }
});
