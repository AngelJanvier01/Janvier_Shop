import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const durationMs = Number(process.env.VECTOR_SOAK_MS ?? 300_000);
const outputDirectory = path.resolve("artifacts/stability");
const pointerLockLifecycleMock = `
  (() => {
    let lockedElement = null;

    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => lockedElement
    });
    Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
      configurable: true,
      value: function requestPointerLock() {
        lockedElement = this;
        document.dispatchEvent(new Event("pointerlockchange"));
        return Promise.resolve();
      }
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: () => {
        lockedElement = null;
        document.dispatchEvent(new Event("pointerlockchange"));
      }
    });
  })();
`;

type Sample = {
  elapsedMs: number;
  heapBytes: number | null;
  trailNodes: number;
};

async function main() {
  if (!Number.isFinite(durationMs) || durationMs < 1_000) {
    throw new Error("VECTOR_SOAK_MS must be a number of at least 1000 milliseconds.");
  }

  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 720 }
  });
  await context.addInitScript(pointerLockLifecycleMock);
  const page = await context.newPage();
  const consoleProblems: string[] = [];
  const samples: Sample[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const control = page.getByTestId("vector-mode-activate");
  await control.waitFor();

  const startedAt = Date.now();
  let cycleCount = 0;
  while (Date.now() - startedAt < durationMs) {
    await control.click();
    await page.waitForFunction(
      () => document.pointerLockElement === document.documentElement
    );
    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => document.pointerLockElement === null);

    const sample = await page.evaluate(() => {
      const memory = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      return {
        heapBytes: memory.memory?.usedJSHeapSize ?? null,
        trailNodes: document.querySelectorAll("[data-testid='vector-mode'] span").length
      };
    });
    samples.push({ elapsedMs: Date.now() - startedAt, ...sample });
    cycleCount += 1;
    await page.waitForTimeout(500);
  }

  const heapSamples = samples
    .map((sample) => sample.heapBytes)
    .filter((value): value is number => value !== null);
  const firstHeap = heapSamples[0];
  const lastHeap = heapSamples.at(-1);
  const expectedTrailNodes = samples[0]?.trailNodes;
  const report = {
    baseUrl,
    consoleProblems,
    cycleCount,
    durationMs,
    expectedTrailNodes,
    heapBytes: {
      first: firstHeap ?? null,
      last: lastHeap ?? null,
      peak: heapSamples.length ? Math.max(...heapSamples) : null
    },
    samples
  };

  await writeFile(
    path.join(outputDirectory, "vector-mode-soak.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  if (consoleProblems.length > 0) {
    throw new Error(`Vector mode emitted console issues: ${consoleProblems.join(" | ")}`);
  }
  if (samples.some((sample) => sample.trailNodes !== expectedTrailNodes)) {
    throw new Error("Vector mode accumulated or lost trail nodes during the soak test.");
  }
  if (firstHeap && lastHeap && lastHeap > firstHeap * 1.5) {
    throw new Error(
      "Vector mode heap grew beyond the allowed 50% tolerance during the soak test."
    );
  }

  await context.close();
  await browser.close();
  console.log(`VECTOR_MODE_84 soak passed: ${cycleCount} cycles over ${durationMs}ms.`);
}

await main();
