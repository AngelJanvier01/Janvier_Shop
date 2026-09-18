ALTER TYPE "SicoddSyncRunType" ADD VALUE 'CATALOG_ANALYSIS';

ALTER TABLE "SicoddSyncSettings"
  ADD COLUMN "catalogAnalyzedAt" TIMESTAMP(3);

CREATE TABLE "SicoddCatalogFamily" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(24) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SicoddCatalogFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SicoddCatalogSubcategory" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "code" VARCHAR(24) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SicoddCatalogSubcategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product"
  ADD COLUMN "supplierSubcategoryId" TEXT;

CREATE UNIQUE INDEX "SicoddCatalogFamily_code_key" ON "SicoddCatalogFamily"("code");
CREATE INDEX "SicoddCatalogFamily_name_idx" ON "SicoddCatalogFamily"("name");
CREATE INDEX "SicoddCatalogFamily_lastSeenAt_idx" ON "SicoddCatalogFamily"("lastSeenAt");
CREATE UNIQUE INDEX "SicoddCatalogSubcategory_code_key" ON "SicoddCatalogSubcategory"("code");
CREATE INDEX "SicoddCatalogSubcategory_familyId_name_idx" ON "SicoddCatalogSubcategory"("familyId", "name");
CREATE INDEX "SicoddCatalogSubcategory_lastSeenAt_idx" ON "SicoddCatalogSubcategory"("lastSeenAt");
CREATE INDEX "Product_supplierSubcategoryId_status_idx" ON "Product"("supplierSubcategoryId", "status");

ALTER TABLE "SicoddCatalogSubcategory"
  ADD CONSTRAINT "SicoddCatalogSubcategory_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "SicoddCatalogFamily"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_supplierSubcategoryId_fkey"
  FOREIGN KEY ("supplierSubcategoryId") REFERENCES "SicoddCatalogSubcategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
