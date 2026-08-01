import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const outputDirectory = path.resolve("artifacts/stability");

type ConsoleProblem = {
  type: "error" | "warning";
  text: string;
};

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    const metrics = {
      cls: 0,
      events: [] as number[],
      lcp: 0
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntryList) {
          const layoutShift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!layoutShift.hadRecentInput) {
            metrics.cls += layoutShift.value ?? 0;
          }
        }
      }).observe({ buffered: true, type: "layout-shift" });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.lcp = Math.max(metrics.lcp, entry.startTime);
        }
      }).observe({ buffered: true, type: "largest-contentful-paint" });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metrics.events.push(entry.duration);
        }
      }).observe({
        buffered: true,
        durationThreshold: 16,
        type: "event"
      } as PerformanceObserverInit & { durationThreshold: number });
    } catch {
      // Performance entry types vary by browser version. The report marks missing values as null.
    }

    Object.assign(window, { __janvierPerformanceMetrics: metrics });
  });

  const page = await context.newPage();
  const consoleProblems: ConsoleProblem[] = [];
  page.on("console", (message) => {
    const type = message.type();
    if (type === "error" || type === "warning") {
      consoleProblems.push({ type, text: message.text() });
    }
  });
  page.on("pageerror", (error) =>
    consoleProblems.push({ type: "error", text: error.message })
  );

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("header [data-testid='theme-toggle']").click();
  await page.waitForTimeout(250);

  const report = await page.evaluate(() => {
    const metrics = (
      window as typeof window & {
        __janvierPerformanceMetrics?: { cls: number; events: number[]; lcp: number };
      }
    ).__janvierPerformanceMetrics;
    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    const duplicateResources = resources.reduce<Record<string, number>>(
      (totals, resource) => {
        totals[resource.name] = (totals[resource.name] ?? 0) + 1;
        return totals;
      },
      {}
    );
    const navigation = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;

    return {
      documentWidth: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      },
      navigation: {
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadMs: Math.round(navigation.loadEventEnd),
        transferSize: navigation.transferSize
      },
      vitals: {
        cls: Number((metrics?.cls ?? 0).toFixed(4)),
        lcpMs: metrics?.lcp ? Math.round(metrics.lcp) : null,
        maxObservedEventDurationMs: metrics?.events.length
          ? Math.round(Math.max(...metrics.events))
          : null
      },
      resources: {
        count: resources.length,
        css: resources.filter((resource) => resource.initiatorType === "link").length,
        images: resources.filter((resource) => resource.initiatorType === "img").length,
        scripts: resources.filter((resource) => resource.initiatorType === "script")
          .length,
        transferSize: resources.reduce(
          (total, resource) => total + resource.transferSize,
          0
        ),
        duplicateUrls: Object.entries(duplicateResources)
          .filter(([, count]) => count > 1)
          .map(([url, count]) => ({ count, url }))
      }
    };
  });

  const output = { baseUrl, consoleProblems, report };
  await writeFile(
    path.join(outputDirectory, "production-audit.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify(output, null, 2));

  await context.close();
  await browser.close();
}

await main();
