import { defineConfig } from "@playwright/test";

const isProduction = process.env.PLAYWRIGHT_MODE === "production";
const targetsExternalDeployment = process.env.PLAYWRIGHT_EXTERNAL === "true";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (isProduction ? "http://127.0.0.1:3002" : "http://127.0.0.1:3001");
const configuredWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? "", 10);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers:
    Number.isSafeInteger(configuredWorkers) && configuredWorkers > 0
      ? configuredWorkers
      : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: targetsExternalDeployment
    ? undefined
    : {
        command: isProduction ? "node scripts/start-e2e-production.mjs" : "npm run dev",
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000
      }
});
