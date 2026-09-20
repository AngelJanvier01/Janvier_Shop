import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002";
const environment = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: baseUrl,
  PLAYWRIGHT_BASE_URL: baseUrl,
  PLAYWRIGHT_MODE: "production"
};

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      env: environment,
      // Windows cannot always execute a .cmd shim directly from an ESM child
      // process. The command and its arguments are static project scripts, so
      // using the platform shell here keeps the production test runner portable.
      shell: process.platform === "win32",
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${npmCommand} terminó por la señal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${npmCommand} ${args.join(" ")} terminó con código ${code}.`));
        return;
      }

      resolve();
    });
  });
}

await run(["run", "build"]);
await run(["run", "test:e2e"]);
