import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002";
const outputDirectory = path.resolve("artifacts/index-hero-monogram");

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: outputDirectory,
      size: { height: 900, width: 1440 }
    },
    viewport: { height: 900, width: 1440 }
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const mark = page.getByTestId("index-hero-monogram-svg");
  const toggle = page.locator("header [data-testid='theme-toggle']");
  const video = page.video();

  for (let index = 0; index < 50; index += 1) {
    await toggle.click();
    const state = await mark.evaluate((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return { height: rect.height, opacity: Number(style.opacity), width: rect.width };
    });
    if (state.width < 350 || state.height < 350 || state.opacity < 0.99) {
      throw new Error(`Monogram invariant failed at theme change ${index + 1}.`);
    }
    await page.waitForTimeout(80);
  }

  await page.screenshot({ path: path.join(outputDirectory, "after-stress-final.png") });
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error("Playwright did not create the requested monogram stress video.");
  }
  console.log(`Index hero monogram stress video: ${await video.path()}`);
}

await main();
