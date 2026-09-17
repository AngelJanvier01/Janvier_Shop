import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const environment = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://generate:generate@127.0.0.1:5432/janvier_generate?schema=public"
};

// Invoking the JavaScript entry point avoids Windows' `prisma.cmd` shell shim,
// which cannot be spawned directly by Node on every supported shell.
const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  env: environment,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
