import type { Page } from "@playwright/test";

const benignNextCssPreloadWarning =
  /\/_next\/static\/css\/[^\s]+\.css was preloaded using link preload but not used/u;

/**
 * Keep the stability suites strict while ignoring Chromium's delayed warning
 * for Next-managed CSS that was legitimately consumed before client navigation.
 */
export function collectConsoleProblems(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    const type = message.type();
    const messageText = message.text();
    if (type === "warning" && benignNextCssPreloadWarning.test(messageText)) return;
    if (type === "error" || type === "warning") {
      problems.push(`${type}: ${messageText}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}
