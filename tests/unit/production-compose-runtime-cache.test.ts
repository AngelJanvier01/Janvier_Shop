import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type ServiceConfiguration = {
  depends_on?: Record<string, { condition?: string }>;
  environment?: Record<string, unknown>;
  read_only?: boolean;
  tmpfs?: unknown;
  user?: string;
  volumes?: unknown;
};

type ProductionCompose = {
  services: {
    database: ServiceConfiguration;
    "background-removal": ServiceConfiguration;
    "email-worker": ServiceConfiguration;
    "image-worker": ServiceConfiguration;
    "payment-expiration-worker": ServiceConfiguration;
    migrate: ServiceConfiguration;
    web: ServiceConfiguration;
  };
};

function tmpfsEntry(target: string, entries: unknown): string {
  expect(entries).toBeInstanceOf(Array);
  const entry = (entries as unknown[]).find(
    (value): value is string =>
      typeof value === "string" && value.split(":", 1)[0] === target
  );

  expect(entry).toBeDefined();
  return entry as string;
}

function tmpfsOptions(entry: string): Set<string> {
  const separator = entry.indexOf(":");
  expect(separator).toBeGreaterThan(0);
  return new Set(entry.slice(separator + 1).split(","));
}

function shortMountTargets(entries: unknown): string[] {
  expect(entries).toBeInstanceOf(Array);
  return (entries as unknown[]).flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const parts = entry.split(":");
    return parts.length >= 2 ? [parts[1]] : [];
  });
}

async function productionCompose(): Promise<ProductionCompose> {
  const source = await readFile(
    resolve(process.cwd(), "compose.production.yaml"),
    "utf8"
  );
  return parse(source) as ProductionCompose;
}

describe("production Next runtime cache mount", () => {
  it("keeps the web root filesystem read-only with the required tmpfs mounts", async () => {
    const compose = await productionCompose();
    const web = compose.services.web;

    expect(web.user).toBe("1001:1001");
    expect(web.read_only).toBe(true);
    expect(tmpfsEntry("/tmp", web.tmpfs)).toBe("/tmp");

    const cache = tmpfsEntry("/app/.next/cache", web.tmpfs);
    expect(cache).toBe(
      "/app/.next/cache:rw,nosuid,nodev,noexec,size=64m,mode=0700,uid=1001,gid=1001"
    );
    expect(tmpfsOptions(cache)).toEqual(
      new Set([
        "rw",
        "nosuid",
        "nodev",
        "noexec",
        "size=64m",
        "mode=0700",
        "uid=1001",
        "gid=1001"
      ])
    );
  });

  it("keeps application mounts narrow and preserves persistent data mounts", async () => {
    const compose = await productionCompose();
    const webTargets = shortMountTargets(compose.services.web.volumes);
    const databaseTargets = shortMountTargets(compose.services.database.volumes);

    expect(webTargets).toContain("/var/lib/janvier/proposal-assets");
    expect(webTargets).toContain("/var/lib/janvier/product-images");
    expect(databaseTargets).toContain("/var/lib/postgresql/data");
    expect(webTargets).not.toContain("/app");
    expect(webTargets).not.toContain("/app/.next");
    expect(webTargets).not.toContain("/app/.next/cache");
    expect(databaseTargets).not.toContain("/app/.next/cache");
    expect(compose.services.database.tmpfs).toBeUndefined();
    expect(compose.services.database.user).toBeUndefined();
    expect(compose.services.migrate.user).toBeUndefined();
  });

  it("isolates the local background-removal model and persistent derivatives", async () => {
    const compose = await productionCompose();
    const processor = compose.services["background-removal"];
    const worker = compose.services["image-worker"];

    expect(processor.read_only).toBe(true);
    expect(shortMountTargets(processor.volumes)).toContain("/models/huggingface");
    expect(worker.read_only).toBe(true);
    expect(shortMountTargets(worker.volumes)).toContain(
      "/var/lib/janvier/product-images"
    );
    expect(worker.environment?.PRODUCT_IMAGE_WORKER_ENABLED).toBe("true");
    expect(worker.environment?.JANVIER_OPERATIONS_STORAGE_SCOPE).toBe("product-images");
    expect(worker.environment?.BACKGROUND_REMOVAL_URL).toBe(
      "http://background-removal:8080"
    );
    expect(worker.depends_on?.["background-removal"]?.condition).toBe("service_healthy");
  });

  it("keeps mail disabled by default and OAuth secrets runtime-only", async () => {
    const compose = await productionCompose();
    const environment = compose.services.web.environment;

    expect(environment?.MAIL_ENABLED).toBe("${MAIL_ENABLED:-false}");
    expect(environment?.GOOGLE_OAUTH_CLIENT_ID).toBe("${GOOGLE_OAUTH_CLIENT_ID:-}");
    expect(environment?.GOOGLE_OAUTH_CLIENT_SECRET).toBe(
      "${GOOGLE_OAUTH_CLIENT_SECRET:-}"
    );
    expect(environment?.SETTINGS_ENCRYPTION_KEY).toBe("${SETTINGS_ENCRYPTION_KEY:-}");
    expect(environment?.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL).toBe(
      "${CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL:-}"
    );
    expect(environment?.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_SECRET).toBe(
      "${CUSTOMER_EMAIL_DELIVERY_WEBHOOK_SECRET:-}"
    );
    expect(environment?.SICODD_BASE_URL).toBe("${SICODD_BASE_URL:-}");
    expect(environment?.SICODD_USERNAME).toBe("${SICODD_USERNAME:-}");
    expect(environment?.SICODD_ADMIN_PASSWORD).toBe("${SICODD_ADMIN_PASSWORD:-}");

    const emailWorker = compose.services["email-worker"];
    expect(emailWorker.read_only).toBe(true);
    expect(emailWorker.environment?.JANVIER_OPERATIONS_STORAGE_SCOPE).toBe(
      "database-only"
    );
    expect(emailWorker.environment?.MAIL_ENABLED).toBe("${MAIL_ENABLED:-false}");
    expect(emailWorker.environment?.MP_ACCESS_TOKEN).toBeUndefined();

    const imageWorker = compose.services["image-worker"];
    expect(imageWorker.environment?.MP_ACCESS_TOKEN).toBeUndefined();
    expect(imageWorker.environment?.SMTP_APP_PASSWORD).toBeUndefined();

    const paymentExpirationWorker = compose.services["payment-expiration-worker"];
    expect(paymentExpirationWorker.environment?.MP_ACCESS_TOKEN).toBeUndefined();
    expect(paymentExpirationWorker.environment?.SICODD_ADMIN_PASSWORD).toBeUndefined();
  });
});
