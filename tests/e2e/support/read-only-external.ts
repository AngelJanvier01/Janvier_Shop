import { expect, test as base, type BrowserContext } from "@playwright/test";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const analyticsHosts = /(^|\.)(google-analytics\.com|googletagmanager\.com)$/iu;

/** Prevent the public production audit from creating application or analytics data. */
export async function protectExternalContext(context: BrowserContext) {
  if (process.env.PLAYWRIGHT_EXTERNAL !== "true") return;

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isAnalytics =
      url.pathname.startsWith("/api/analytics/") || analyticsHosts.test(url.hostname);
    if (!safeMethods.has(request.method()) || isAnalytics) {
      await route.fulfill({ body: "", status: 204 });
      return;
    }
    await route.continue();
  });
}

export const test = base.extend({
  context: async ({ context }, fixtureUse) => {
    await protectExternalContext(context);
    await fixtureUse(context);
  }
});

export { expect };
