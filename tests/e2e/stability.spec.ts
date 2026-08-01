import { expect, test, type Page } from "@playwright/test";

const routes = [
  "/",
  "/estudio",
  "/soluciones",
  "/proyectos",
  "/suministro",
  "/laboratorio",
  "/acerca",
  "/contacto"
];

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

type Theme = "neutral" | "night";

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

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((nextTheme) => {
    window.localStorage.setItem("janvier-theme", nextTheme);
  }, theme);
}

async function assertVisibleLogo(page: Page, selector: string) {
  const logo = page.locator(selector);
  await expect(logo).toHaveCount(1);
  await expect(logo).toBeVisible();

  const state = await logo.evaluate((element) => {
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return {
      display: styles.display,
      height: rect.height,
      opacity: styles.opacity,
      visibility: styles.visibility,
      width: rect.width
    };
  });

  expect(state.width).toBeGreaterThan(0);
  expect(state.height).toBeGreaterThan(0);
  expect(state.opacity).toBe("1");
  expect(state.visibility).toBe("visible");
  expect(state.display).not.toBe("none");
}

async function assertStableShell(page: Page) {
  await assertVisibleLogo(page, "header [data-brand-logo='mark']");
  await assertVisibleLogo(page, "footer [data-brand-logo='lockup']");
  await expect(page.locator("header")).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertContainedLayout(page: Page) {
  const report = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const outOfBoundsControls = Array.from(
      document.querySelectorAll<HTMLElement>("a, button")
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > clientWidth + 1;
    }).length;
    const title = document.querySelector<HTMLElement>("[data-testid='page-hero'] h1");
    const titleMask = title?.parentElement;
    const titleOutOfBounds = title
      ? title.getBoundingClientRect().left < -1 ||
        title.getBoundingClientRect().right > clientWidth + 1
      : false;

    return {
      clientWidth,
      outOfBoundsControls,
      scrollWidth: document.documentElement.scrollWidth,
      titleIsVisible: title ? getComputedStyle(title).opacity === "1" : true,
      titleMaskOverflow: titleMask ? getComputedStyle(titleMask).overflowY : "visible",
      titleOutOfBounds
    };
  });

  expect(report.scrollWidth).toBeLessThanOrEqual(report.clientWidth + 1);
  expect(report.outOfBoundsControls).toBe(0);
  expect(report.titleOutOfBounds).toBe(false);
  expect(report.titleIsVisible).toBe(true);
  expect(["hidden", "clip"]).not.toContain(report.titleMaskOverflow);
}

test("el tema resiste 50 cambios, 20 recargas y mantiene el logo", async ({ page }) => {
  test.setTimeout(120000);
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("/", { waitUntil: "networkidle" });
  const toggle = page.locator("header [data-testid='theme-toggle']");
  await expect(toggle).toHaveCount(1);

  let activeTheme: Theme = "neutral";
  for (let index = 0; index < 50; index += 1) {
    activeTheme = activeTheme === "neutral" ? "night" : "neutral";
    await toggle.click();
    await expect
      .poll(() => page.locator("html").getAttribute("data-theme"))
      .toBe(activeTheme);
    await assertStableShell(page);
  }

  for (let index = 0; index < 20; index += 1) {
    activeTheme = index % 2 === 0 ? "neutral" : "night";
    await setTheme(page, activeTheme);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", activeTheme);
    await assertStableShell(page);
  }

  expect(consoleProblems).toEqual([]);
});

for (const viewport of viewports) {
  test(`matriz responsive sin overflow en ${viewport.width}×${viewport.height}`, async ({
    browser
  }) => {
    test.setTimeout(120000);
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await page.goto("/", { waitUntil: "networkidle" });

    for (const route of routes) {
      for (const theme of ["neutral", "night"] as const) {
        await setTheme(page, theme);
        await page.goto(route, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await assertStableShell(page);
        await assertContainedLayout(page);
      }
    }

    await context.close();
  });
}

test("el menú móvil se abre y cierra repetidamente sin dejar foco ni overflow", async ({
  browser
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 1,
    isMobile: true,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();

  await page.goto("/", { waitUntil: "networkidle" });
  const menuButton = page.getByTestId("mobile-menu-toggle");
  await expect(menuButton).toHaveCount(1);

  for (let index = 0; index < 10; index += 1) {
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await assertStableShell(page);
    await assertContainedLayout(page);

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  }

  await expect(menuButton).toBeFocused();
  await context.close();
});
