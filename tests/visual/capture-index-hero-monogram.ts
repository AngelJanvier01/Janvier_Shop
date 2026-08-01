import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContextOptions } from "@playwright/test";

type Theme = "neutral" | "night";

type CaptureState = {
  centerX: number;
  centerY: number;
  height: number;
  panelHeight: number;
  panelWidth: number;
  width: number;
};

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002";
const outputDirectory = path.resolve("artifacts/index-hero-monogram");
const viewports: Array<{ name: string; options: BrowserContextOptions }> = [
  { name: "320x568", options: { isMobile: true, viewport: { width: 320, height: 568 } } },
  { name: "375x812", options: { isMobile: true, viewport: { width: 375, height: 812 } } },
  { name: "768x1024", options: { viewport: { width: 768, height: 1024 } } },
  { name: "1366x768", options: { viewport: { width: 1366, height: 768 } } },
  { name: "1440x900", options: { viewport: { width: 1440, height: 900 } } },
  { name: "1920x1080", options: { viewport: { width: 1920, height: 1080 } } }
];

function minimumDimension(viewportWidth: number) {
  if (viewportWidth <= 320) return 180;
  if (viewportWidth <= 480) return 200;
  if (viewportWidth <= 1024) return 320;
  return 350;
}

async function capture(theme: Theme, viewport: (typeof viewports)[number]) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...viewport.options,
    reducedMotion: "reduce"
  });
  await context.addInitScript((storedTheme: Theme) => {
    window.localStorage.setItem("janvier-theme", storedTheme);
  }, theme);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  const state = await page.getByTestId("index-hero-monogram-svg").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const panelRect = node.parentElement?.parentElement?.getBoundingClientRect();
    return {
      centerX: rect.left + rect.width / 2 - (panelRect?.left ?? 0),
      centerY: rect.top + rect.height / 2 - (panelRect?.top ?? 0),
      height: rect.height,
      panelHeight: panelRect?.height ?? 0,
      panelWidth: panelRect?.width ?? 0,
      width: rect.width
    };
  });

  const width = viewport.options.viewport?.width ?? 0;
  const minimum = minimumDimension(width);
  assert.ok(
    state.width >= minimum,
    `${viewport.name}/${theme}: monogram width collapsed.`
  );
  assert.ok(
    state.height >= minimum,
    `${viewport.name}/${theme}: monogram height collapsed.`
  );
  assert.ok(
    state.width <= state.panelWidth,
    `${viewport.name}/${theme}: monogram overflows panel (${JSON.stringify(state)}).`
  );
  assert.ok(
    state.height <= state.panelHeight,
    `${viewport.name}/${theme}: monogram is clipped (${JSON.stringify(state)}).`
  );

  const screenshotPath = path.join(
    outputDirectory,
    `after-${viewport.name}-${theme}.png`
  );
  await page.getByTestId("index-hero-monogram-panel").scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshotPath });
  await context.close();
  await browser.close();

  return { screenshotPath, state };
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const results = new Map<string, CaptureState>();

  for (const viewport of viewports) {
    for (const theme of ["neutral", "night"] as const) {
      const result = await capture(theme, viewport);
      results.set(`${viewport.name}-${theme}`, result.state);
      console.log(`Captured ${result.screenshotPath}`);
    }

    const neutral = results.get(`${viewport.name}-neutral`);
    const night = results.get(`${viewport.name}-night`);
    assert.ok(neutral && night, `${viewport.name}: missing comparison state.`);
    assert.ok(
      Math.abs(neutral.width - night.width) <= 1 &&
        Math.abs(neutral.height - night.height) <= 1,
      `${viewport.name}: theme changed monogram dimensions.`
    );
    assert.ok(
      Math.abs(neutral.centerX - night.centerX) <= 1 &&
        Math.abs(neutral.centerY - night.centerY) <= 1,
      `${viewport.name}: theme changed monogram position.`
    );
  }
}

await main();
