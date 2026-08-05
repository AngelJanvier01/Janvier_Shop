import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type ServiceConfiguration = {
  environment?: Record<string, unknown>;
  read_only?: boolean;
  tmpfs?: unknown;
  user?: string;
  volumes?: unknown;
};

type ProductionCompose = {
  services: {
    database: ServiceConfiguration;
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
    expect(databaseTargets).toContain("/var/lib/postgresql/data");
    expect(webTargets).not.toContain("/app");
    expect(webTargets).not.toContain("/app/.next");
    expect(webTargets).not.toContain("/app/.next/cache");
    expect(databaseTargets).not.toContain("/app/.next/cache");
    expect(compose.services.database.tmpfs).toBeUndefined();
    expect(compose.services.database.user).toBeUndefined();
    expect(compose.services.migrate.user).toBeUndefined();
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
  });
});
