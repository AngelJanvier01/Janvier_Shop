import { expect, test, type BrowserContext, type Page } from "@playwright/test";

type Theme = "neutral" | "night";

type MarkState = {
  connected: boolean;
  display: string;
  height: number;
  opacity: number;
  panelHeight: number;
  panelWidth: number;
  scaleX: number;
  scaleY: number;
  transform: string;
  visibility: string;
  width: number;
};

function minimumMarkDimension(viewportWidth: number) {
  if (viewportWidth <= 375) return 180;
  if (viewportWidth <= 480) return 200;
  if (viewportWidth <= 1024) return 320;
  return 350;
}

async function validateIndexHeroMonogram(
  page: Page,
  viewportWidth: number
): Promise<MarkState> {
  const mark = page.getByTestId("index-hero-monogram-svg");
  const panel = page.getByTestId("index-hero-monogram-panel");

  await expect(mark).toHaveCount(1);
  await expect(panel).toHaveCount(1);
  await expect(mark).toBeVisible();

  const state = await mark.evaluate((node) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const panelRect = node.parentElement?.parentElement?.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(
      style.transform === "none" ? undefined : style.transform
    );

    return {
      connected: node.isConnected,
      display: style.display,
      height: rect.height,
      opacity: Number(style.opacity),
      panelHeight: panelRect?.height ?? 0,
      panelWidth: panelRect?.width ?? 0,
      scaleX: Math.hypot(matrix.a, matrix.b),
      scaleY: Math.hypot(matrix.c, matrix.d),
      transform: style.transform,
      visibility: style.visibility,
      width: rect.width
    };
  });

  const minimumDimension = minimumMarkDimension(viewportWidth);
  expect(state.connected).toBe(true);
  expect(state.width).toBeGreaterThan(100);
  expect(state.height).toBeGreaterThan(100);
  expect(state.width).toBeGreaterThanOrEqual(minimumDimension);
  expect(state.height).toBeGreaterThanOrEqual(minimumDimension);
  expect(state.opacity).toBeGreaterThan(0.99);
  expect(state.visibility).not.toBe("hidden");
  expect(state.display).not.toBe("none");
  expect(state.scaleX).toBeGreaterThanOrEqual(0.999);
  expect(state.scaleY).toBeGreaterThanOrEqual(0.999);
  expect(state.panelWidth).toBeGreaterThanOrEqual(state.width);
  expect(state.panelHeight).toBeGreaterThanOrEqual(state.height);

  return state;
}

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("janvier-theme", nextTheme);
  }, theme);
}

function collectConsoleProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

async function openIndex(
  context: BrowserContext,
  viewport: { height: number; width: number }
) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto("/", { waitUntil: "networkidle" });
  return page;
}

test("INDEX_HERO_MONOGRAM conserva dimensión y conexión bajo interacción repetida", async ({
  browser
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1440, height: 900 }
  });
  const page = await openIndex(context, { width: 1440, height: 900 });
  const consoleProblems = collectConsoleProblems(page);

  await page.waitForTimeout(1_300);
  const mark = page.getByTestId("index-hero-monogram-svg");
  await mark.evaluate((node) => {
    Object.assign(window, { __indexHeroMonogram: node });
  });
  await validateIndexHeroMonogram(page, 1440);

  const toggle = page.locator("header [data-testid='theme-toggle']");
  for (let index = 0; index < 50; index += 1) {
    await toggle.click();
    await validateIndexHeroMonogram(page, 1440);
    await expect
      .poll(() =>
        mark.evaluate(
          (node) =>
            (
              window as typeof window & {
                __indexHeroMonogram?: Element;
              }
            ).__indexHeroMonogram === node
        )
      )
      .toBe(true);
  }

  for (let index = 0; index < 20; index += 1) {
    await page.reload({ waitUntil: "networkidle" });
    await validateIndexHeroMonogram(page, 1440);
  }
  await page.waitForTimeout(1_300);
  await validateIndexHeroMonogram(page, 1440);

  await page.goto("/estudio", { waitUntil: "networkidle" });
  await page.goto("/", { waitUntil: "networkidle" });
  await validateIndexHeroMonogram(page, 1440);
  await page.goBack({ waitUntil: "networkidle" });
  await page.goForward({ waitUntil: "networkidle" });
  await validateIndexHeroMonogram(page, 1440);

  await page.setViewportSize({ width: 390, height: 844 });
  await validateIndexHeroMonogram(page, 390);
  const menu = page.getByTestId("mobile-menu-toggle");
  await menu.click();
  await page.locator("[data-testid='theme-toggle']:visible").click();
  await menu.click();
  await validateIndexHeroMonogram(page, 390);
  await page.setViewportSize({ width: 844, height: 390 });
  await validateIndexHeroMonogram(page, 844);

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
  ]) {
    await page.setViewportSize(viewport);
    await validateIndexHeroMonogram(page, viewport.width);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await context.route("**/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    await route.continue();
  });
  await page.reload({ waitUntil: "networkidle" });
  await validateIndexHeroMonogram(page, 1440);

  expect(consoleProblems).toEqual([]);
  await context.close();
});

test("INDEX_HERO_MONOGRAM conserva fallback con reduced motion y sin JavaScript", async ({
  browser
}) => {
  const reducedContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 375, height: 812 }
  });
  const reducedPage = await openIndex(reducedContext, { width: 375, height: 812 });
  await setTheme(reducedPage, "night");
  await reducedPage.reload({ waitUntil: "networkidle" });
  const reducedState = await validateIndexHeroMonogram(reducedPage, 375);
  expect(reducedState.transform).not.toContain("scale(0");
  await reducedContext.close();

  const noJavaScriptContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 }
  });
  const noJavaScriptPage = await openIndex(noJavaScriptContext, {
    width: 375,
    height: 812
  });
  await validateIndexHeroMonogram(noJavaScriptPage, 375);
  await noJavaScriptContext.close();
});
