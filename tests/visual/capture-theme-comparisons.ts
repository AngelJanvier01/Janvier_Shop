import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContextOptions } from "@playwright/test";

type Theme = "neutral" | "night";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const outputDirectory = path.resolve("artifacts/night-comparison");

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

async function captureTheme(
  theme: Theme,
  viewport: (typeof viewports)[number]
): Promise<string> {
  const browser = await chromium.launch();
  const context = await browser.newContext(viewport.options);

  await context.addInitScript((storedTheme: Theme) => {
    window.localStorage.setItem("janvier-theme", storedTheme);
  }, theme);

  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const activeTheme = await page.locator("html").getAttribute("data-theme");
  if (activeTheme !== theme) {
    throw new Error(`Expected ${theme} theme, received ${activeTheme ?? "no theme"}.`);
  }

  const filePath = path.join(outputDirectory, `${viewport.name}-${theme}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  await context.close();
  await browser.close();

  return filePath;
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const captures = await Promise.all(
    viewports.flatMap((viewport) =>
      (["neutral", "night"] as const).map((theme) => captureTheme(theme, viewport))
    )
  );

  console.log("Theme comparison captures created:");
  captures.forEach((capture) => console.log(`- ${capture}`));
}

await main();
