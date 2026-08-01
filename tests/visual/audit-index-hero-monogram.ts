import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002";
const outputDirectory = path.resolve("artifacts/index-hero-monogram");
const markSelector = "[data-testid='index-hero-monogram-svg']";

type MarkState = {
  aspectRatio: string;
  connected: boolean;
  display: string;
  height: number;
  label: string;
  opacity: number;
  panelHeight: number;
  panelWidth: number;
  transform: string;
  viewBox: string | null;
  visibility: string;
  width: number;
  widthCss: string;
};

async function measureMark(page: Page, label: string): Promise<MarkState> {
  const mark = page.locator(markSelector);
  const count = await mark.count();
  if (count !== 1) {
    throw new Error(`Expected exactly one index hero mark; found ${count} for ${label}.`);
  }

  return mark.evaluate((node, measureLabel) => {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const panelRect = node.parentElement?.getBoundingClientRect();

    return {
      aspectRatio: style.aspectRatio,
      connected: node.isConnected,
      display: style.display,
      height: rect.height,
      label: measureLabel,
      opacity: Number(style.opacity),
      panelHeight: panelRect?.height ?? 0,
      panelWidth: panelRect?.width ?? 0,
      transform: style.transform,
      viewBox: node.getAttribute("viewBox"),
      visibility: style.visibility,
      width: rect.width,
      widthCss: style.width
    };
  }, label);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const states: MarkState[] = [];
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_300);
  states.push(await measureMark(page, "initial-desktop"));
  await page.screenshot({ path: path.join(outputDirectory, "after-desktop.png") });

  const toggle = page.locator("header [data-testid='theme-toggle']");
  for (let index = 0; index < 50; index += 1) {
    await toggle.click();
    states.push(await measureMark(page, `theme-${index + 1}`));
  }

  for (let index = 0; index < 20; index += 1) {
    await page.reload({ waitUntil: "networkidle" });
    states.push(await measureMark(page, `reload-${index + 1}-immediate`));
    await page.waitForTimeout(1_300);
    states.push(await measureMark(page, `reload-${index + 1}-settled`));
  }

  await page.goto(`${baseUrl}/estudio`, { waitUntil: "networkidle" });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_300);
  states.push(await measureMark(page, "estudio-index"));
  await page.goBack({ waitUntil: "networkidle" });
  await page.goForward({ waitUntil: "networkidle" });
  await page.waitForTimeout(1_300);
  states.push(await measureMark(page, "back-forward-index"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1_300);
  states.push(await measureMark(page, "mobile-390x844"));
  const menu = page.getByTestId("mobile-menu-toggle");
  await menu.click();
  await page.locator("[data-testid='theme-toggle']:visible").click();
  await menu.click();
  states.push(await measureMark(page, "mobile-menu-theme"));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1_300);
  states.push(await measureMark(page, "mobile-rotation-844x390"));

  await page.setViewportSize({ width: 1440, height: 900 });
  await context.route("**/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    await route.continue();
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1_300);
  states.push(await measureMark(page, "slow-network-reload"));

  const output = {
    baseUrl,
    consoleProblems,
    minimums: {
      height: Math.min(...states.map((state) => state.height)),
      width: Math.min(...states.map((state) => state.width))
    },
    states
  };
  await writeFile(
    path.join(outputDirectory, "after-diagnostic.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify(output, null, 2));

  await context.close();
  await browser.close();
}

await main();
