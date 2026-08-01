import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const outputDirectory = path.resolve("artifacts/stability");

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    recordVideo: {
      dir: outputDirectory,
      size: { width: 390, height: 844 }
    }
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const video = page.video();
  const menuButton = page.getByTestId("mobile-menu-toggle");
  await menuButton.click();

  const toggle = page.locator("[data-testid='theme-toggle']:visible");
  await toggle.click();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-night.png"),
    fullPage: false
  });

  for (let index = 0; index < 49; index += 1) {
    await toggle.click();
    await page.waitForTimeout(80);
  }

  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDirectory, "mobile-neutral.png"),
    fullPage: false
  });
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error("Playwright did not create the requested stress video.");
  }

  console.log(`Theme stress video created: ${await video.path()}`);
}

await main();
