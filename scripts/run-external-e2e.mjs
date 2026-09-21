import { spawn } from "node:child_process";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "https://jaanviieer.com";
const target = new URL(baseUrl);

if (target.protocol !== "https:") {
  throw new Error("PLAYWRIGHT_BASE_URL debe usar HTTPS para una validación externa.");
}
if (target.username || target.password || target.pathname !== "/") {
  throw new Error("PLAYWRIGHT_BASE_URL debe contener sólo el origen público, sin credenciales ni ruta.");
}

const requestedArguments = process.argv.slice(2);
const scope = process.env.PRODUCTION_E2E_SCOPE ?? "public";
const safeDefault = [
  "tests/e2e/site-launch-audit.spec.ts",
  "tests/e2e/application-page.spec.ts",
  "tests/e2e/legal-pages.spec.ts"
];
const argumentsToRun = requestedArguments.length
  ? requestedArguments
  : scope === "full"
    ? []
    : safeDefault;

if (
  scope === "full" &&
  process.env.ALLOW_MUTATING_PRODUCTION_E2E !== "true"
) {
  throw new Error(
    "La suite completa modifica datos. Define ALLOW_MUTATING_PRODUCTION_E2E=true sólo durante una validación controlada."
  );
}

const environment = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: target.origin,
  PLAYWRIGHT_BASE_URL: target.origin,
  PLAYWRIGHT_EXTERNAL: "true",
  PLAYWRIGHT_MODE: "production",
  PLAYWRIGHT_WORKERS: process.env.PLAYWRIGHT_WORKERS ?? "1"
};

await new Promise((resolve, reject) => {
  const child = spawn(npxCommand, ["playwright", "test", ...argumentsToRun], {
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  child.on("error", reject);
  child.on("exit", (code, signal) => {
    if (signal) {
      reject(new Error(`Playwright terminó por la señal ${signal}.`));
      return;
    }
    if (code !== 0) {
      reject(new Error(`Playwright terminó con código ${code}.`));
      return;
    }
    resolve();
  });
});
