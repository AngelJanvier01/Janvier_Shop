import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("production operational safety", () => {
  it("excludes logs and does not ship a legacy default password", async () => {
    expect(await source(".gitignore")).toContain("*.log");
    expect(await source(".dockerignore")).toContain("*.log");
    const legacyBackend = await source("backend/app.js");
    expect(legacyBackend).not.toMatch(/Password:\s*\S+/u);
    expect(legacyBackend).not.toMatch(/ADMIN_PASSWORD\s*\|\|\s*["'][^"']+/u);
  });

  it("fails Docker builds if runtime env files enter the build context", async () => {
    const dockerfile = await source("Dockerfile");
    expect(dockerfile).toContain("RUN test ! -e .env && test ! -e .env.production");
  });

  it("preserves volumes during normal shutdown", async () => {
    for (const path of [
      "scripts/unix/finalizar.sh",
      "scripts/windows/finalizar.ps1",
      "scripts/unix/production-deploy.sh",
      "scripts/unix/production-rollback-code.sh"
    ]) {
      expect(await source(path), path).not.toMatch(
        /(?:compose|Invoke-ProjectCompose)\s+down[^\n]*(?:--volumes|\s-v(?:\s|$))/u
      );
    }
  });

  it("requires explicit confirmation before the destructive restore", async () => {
    const restore = await source("scripts/unix/production-restore.sh");
    expect(restore).toContain("--confirm-destroy-existing-data");
    expect(restore.indexOf("--confirm-destroy-existing-data")).toBeLessThan(
      restore.indexOf("down --remove-orphans --volumes")
    );
  });

  it("never runs migrations during a code-only rollback", async () => {
    const rollback = await source("scripts/unix/production-rollback-code.sh");
    expect(rollback).toContain("--confirm-schema-compatible");
    expect(rollback).not.toMatch(/prisma|db:bootstrap|profile maintenance/iu);
  });

  it("requires a mounted backup destination independent from Git", async () => {
    const backup = await source("scripts/unix/production-backup-to-git.sh");
    expect(backup).toContain("BACKUP_SECONDARY_PATH");
    expect(backup).toContain('mountpoint -q "${BACKUP_SECONDARY_PATH}"');
    expect(backup).toContain("--no-preserve=ownership,mode");
    expect(backup.indexOf("secondary_snapshot=")).toBeLessThan(
      backup.indexOf('git -C "${repository}" push')
    );
  });

  it("keeps the tunnel token out of process arguments", async () => {
    const unit = await source("scripts/systemd/cloudflared-janvier.service");
    expect(unit).toContain("--token-file /etc/cloudflared/tunnel-token");
    expect(unit).not.toMatch(/\s--token\s/iu);
  });

  it("validates the Mercado Pago signature before touching payment data", async () => {
    const webhook = await source("app/api/webhooks/mercado-pago/route.ts");
    const verification = webhook.indexOf("!verifyMercadoPagoWebhookSignature({");
    const firstMutation = webhook.indexOf("database.commercePaymentWebhook");
    expect(verification).toBeGreaterThan(0);
    expect(firstMutation).toBeGreaterThan(verification);
  });

  it("drops long-running operation containers to the unprivileged app user", async () => {
    const entrypoint = await source("scripts/docker/run-operations.sh");
    expect(entrypoint).toContain('exec su-exec janvier "$@"');
  });

  it("keeps smoke and external E2E non-destructive", async () => {
    const smoke = await source("scripts/smoke/production-smoke.mjs");
    expect(smoke).not.toMatch(/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/iu);

    const runner = await source("scripts/run-external-e2e.mjs");
    expect(runner).toContain("requestedArguments.length");
    expect(runner).not.toContain("ALLOW_MUTATING_PRODUCTION_E2E");

    const guard = await source("tests/e2e/support/read-only-external.ts");
    expect(guard).toContain('new Set(["GET", "HEAD", "OPTIONS"])');
    expect(guard).toContain("/api/analytics/");
  });
});
