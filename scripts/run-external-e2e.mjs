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
const safeDefault = [
  "tests/e2e/site-launch-audit.spec.ts",
  "tests/e2e/application-page.spec.ts",
  "tests/e2e/legal-pages.spec.ts"
];
if (requestedArguments.length || process.env.PRODUCTION_E2E_SCOPE === "full") {
  throw new Error(
    "El runner externo sólo permite la suite pública no destructiva predefinida. Usa una base efímera aislada para otras pruebas."
  );
}
const argumentsToRun = safeDefault;

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
