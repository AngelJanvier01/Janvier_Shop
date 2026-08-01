import { defineConfig } from "@playwright/test";

const isProduction = process.env.PLAYWRIGHT_MODE === "production";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (isProduction ? "http://127.0.0.1:3002" : "http://127.0.0.1:3001");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: isProduction ? "npm run start -- --port 3002" : "npm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
