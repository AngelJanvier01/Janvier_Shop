import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260917020000_harden_commerce_catalog/migration.sql"
);

describe("commerce hardening migration", () => {
  it("enforces one active cart and persists quote snapshots", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "CommerceCart_one_active_per_account_idx"'
    );
    expect(sql).toContain("WHERE \"status\" = 'ACTIVE'");
    expect(sql).toContain('ADD COLUMN "snapshotUnitPriceWithTax"');
    expect(sql).toContain('ADD COLUMN "snapshotAt"');
  });

  it("adds trigram indexes for public catalog search", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(sql).toContain('"Product_name_trgm_idx"');
    expect(sql).toContain('"Product_sku_trgm_idx"');
  });
});
