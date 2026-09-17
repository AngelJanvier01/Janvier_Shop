-- Preserve only the most recently updated ACTIVE cart for each account before
-- enforcing the invariant. Older duplicates remain available as CLOSED history.
WITH ranked AS (
  SELECT "id",
    ROW_NUMBER() OVER (
      PARTITION BY "accountId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS position
  FROM "CommerceCart"
  WHERE "status" = 'ACTIVE'::"CommerceCartStatus"
)
UPDATE "CommerceCart" AS cart
SET "status" = 'CLOSED'::"CommerceCartStatus",
    "updatedAt" = NOW()
FROM ranked
WHERE cart."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX "CommerceCart_one_active_per_account_idx"
  ON "CommerceCart"("accountId")
  WHERE "status" = 'ACTIVE'::"CommerceCartStatus";

ALTER TABLE "CommerceCartItem"
  ADD COLUMN "snapshotName" TEXT,
  ADD COLUMN "snapshotSku" VARCHAR(80),
  ADD COLUMN "snapshotBrand" VARCHAR(100),
  ADD COLUMN "snapshotUnitPriceWithTax" DECIMAL(14, 2),
  ADD COLUMN "snapshotDiscountPct" DECIMAL(9, 4),
  ADD COLUMN "snapshotStockTotal" INTEGER,
  ADD COLUMN "snapshotAt" TIMESTAMP(3);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_description_trgm_idx" ON "Product" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Product_brand_trgm_idx" ON "Product" USING GIN ("brand" gin_trgm_ops);
CREATE INDEX "Product_category_trgm_idx" ON "Product" USING GIN ("category" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "Product_partNumber_trgm_idx" ON "Product" USING GIN ("partNumber" gin_trgm_ops);
CREATE INDEX "Product_upc_trgm_idx" ON "Product" USING GIN ("upc" gin_trgm_ops);
CREATE INDEX "Product_status_name_idx" ON "Product"("status", "name");
CREATE INDEX "Product_status_brand_idx" ON "Product"("status", "brand");
CREATE INDEX "Product_status_price_idx" ON "Product"("status", "basePriceWithTax");
