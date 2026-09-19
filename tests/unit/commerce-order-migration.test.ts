import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260919050000_commerce_order_workflow/migration.sql"
);

describe("commerce order workflow migration", () => {
  it("persists immutable orders linked to their originating quotation", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('CREATE TYPE "CommerceOrderStatus"');
    expect(sql).toContain('CREATE TABLE "CommerceOrder"');
    expect(sql).toContain('CREATE TABLE "CommerceOrderItem"');
    expect(sql).toContain('"sourceQuoteId"');
    expect(sql).toContain('"CommerceOrder_accountId_fkey"');
    expect(sql).toContain('"CommerceOrderItem_orderId_fkey"');
  });

  it("indexes account history and the operational queue", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('"CommerceOrder_accountId_status_updatedAt_idx"');
    expect(sql).toContain('"CommerceOrder_status_requestedAt_idx"');
    expect(sql).toContain('"CommerceOrder_sourceQuoteId_key"');
  });
});
