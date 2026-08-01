import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContextOptions, type Page } from "@playwright/test";

type Theme = "neutral" | "night";
type RouteName = "estudio" | "soluciones";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const outputDirectory = path.resolve("artifacts/page-hero-comparison");
const routes: RouteName[] = ["estudio", "soluciones"];

const viewports: Array<{
  name: "desktop" | "mobile";
  options: BrowserContextOptions;
}> = [
  {
    name: "desktop",
    options: {
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1
    }
  },
  {
    name: "mobile",
    options: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true
    }
  }
];

type HeroMetrics = {
  descriptionBottom: number;
  headerHeight: number;
  heroBottom: number;
  heroTop: number;
  labelTop: number;
  pageOverflows: boolean;
  titleBottom: number;
  titleTop: number;
  visualTop: number;
  visualExists: boolean;
  desktopNavigationFits: boolean;
};

async function readMetrics(page: Page): Promise<HeroMetrics> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const hero = document.querySelector<HTMLElement>("[data-testid='page-hero']");
    const label = hero?.querySelector("p");
    const title = hero?.querySelector("h1");
    const description = hero?.querySelectorAll("p")[1];
    const visual = hero?.querySelector("div[aria-hidden='true']");
    const desktopNavigation = header?.querySelector(
      "nav[aria-label='Navegación principal']"
    );
    const headerInner = header?.firstElementChild;

    if (!header || !hero || !label || !title || !description || !headerInner) {
      throw new Error("The shared header or PageHero is missing from the page.");
    }

    const headerRect = header.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const descriptionRect = description.getBoundingClientRect();
    const visualRect = visual?.getBoundingClientRect();
    const navRect = desktopNavigation?.getBoundingClientRect();
    const innerRect = headerInner.getBoundingClientRect();

    return {
      descriptionBottom: descriptionRect.bottom,
      headerHeight: headerRect.height,
      heroBottom: heroRect.bottom,
      heroTop: heroRect.top,
      labelTop: labelRect.top,
      pageOverflows: document.documentElement.scrollWidth > window.innerWidth + 1,
      titleBottom: titleRect.bottom,
      titleTop: titleRect.top,
      visualTop: visualRect?.top ?? heroRect.bottom,
      visualExists: Boolean(hero.querySelector("div[aria-hidden='true']")),
      desktopNavigationFits:
        !navRect || (navRect.left >= innerRect.left && navRect.right <= innerRect.right)
    };
  });
}

function assertMetrics(
  metrics: HeroMetrics,
  viewport: "desktop" | "mobile",
  route: RouteName
) {
  const expectedHeaderHeight = viewport === "desktop" ? 92 : 68;
  const minimumTopSpace = viewport === "desktop" ? 64 : 52;
  const minimumBottomSpace = viewport === "desktop" ? 72 : 64;

  if (Math.abs(metrics.headerHeight - expectedHeaderHeight) > 1) {
    throw new Error(`${route}: header height must be ${expectedHeaderHeight}px.`);
  }

  if (metrics.heroTop + 1 < metrics.headerHeight) {
    throw new Error(`${route}: PageHero begins underneath the header.`);
  }

  if (metrics.labelTop - metrics.heroTop < minimumTopSpace) {
    throw new Error(`${route}: technical label is too close to the header.`);
  }

  if (
    metrics.titleTop <= metrics.labelTop ||
    metrics.titleBottom >= metrics.descriptionBottom
  ) {
    throw new Error(`${route}: title rhythm is not preserved.`);
  }

  const bottomBoundary = viewport === "mobile" ? metrics.visualTop : metrics.heroBottom;
  if (bottomBoundary - metrics.descriptionBottom < minimumBottomSpace) {
    throw new Error(`${route}: description is too close to the hero divider.`);
  }

  if (!metrics.visualExists) {
    throw new Error(`${route}: shared visual column is missing.`);
  }

  if (!metrics.desktopNavigationFits) {
    throw new Error(`${route}: desktop navigation exceeds the header container.`);
  }

  if (metrics.pageOverflows) {
    throw new Error(`${route}: the page has horizontal overflow.`);
  }
}

async function createPage(theme: Theme, options: BrowserContextOptions) {
  const browser = await chromium.launch();
  const context = await browser.newContext(options);
  await context.addInitScript((storedTheme: Theme) => {
    window.localStorage.setItem("janvier-theme", storedTheme);
  }, theme);

  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  return { browser, context, page };
}

async function capture(
  route: RouteName,
  theme: Theme,
  viewport: (typeof viewports)[number]
) {
  const { browser, context, page } = await createPage(theme, viewport.options);
  await page.goto(`${baseUrl}/${route}`, { waitUntil: "networkidle" });

  const activeTheme = await page.locator("html").getAttribute("data-theme");
  if (activeTheme !== theme) {
    throw new Error(
      `${route}: expected ${theme} theme, received ${activeTheme ?? "no theme"}.`
    );
  }

  assertMetrics(await readMetrics(page), viewport.name, route);

  const filePath = path.join(outputDirectory, `${route}-${viewport.name}-${theme}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  await context.close();
  await browser.close();

  return filePath;
}

async function auditDesktopBreakpoints() {
  const widths = [1280, 1366, 1440, 1920];

  for (const width of widths) {
    for (const route of routes) {
      const { browser, context, page } = await createPage("neutral", {
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1
      });
      await page.goto(`${baseUrl}/${route}`, { waitUntil: "networkidle" });
      assertMetrics(await readMetrics(page), "desktop", route);
      await context.close();
      await browser.close();
    }
  }
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  await auditDesktopBreakpoints();

  const captures: string[] = [];
  for (const route of routes) {
    for (const viewport of viewports) {
      for (const theme of ["neutral", "night"] as const) {
        captures.push(await capture(route, theme, viewport));
      }
    }
  }

  console.log("PageHero audit passed at 1280, 1366, 1440 and 1920px.");
  console.log("PageHero comparison captures created:");
  captures.forEach((capturePath) => console.log(`- ${capturePath}`));
}

await main();
