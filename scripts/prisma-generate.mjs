import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "prisma.cmd" : "prisma";
const environment = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://generate:generate@127.0.0.1:5432/janvier_generate?schema=public"
};

const result = spawnSync(command, ["generate"], {
  env: environment,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
