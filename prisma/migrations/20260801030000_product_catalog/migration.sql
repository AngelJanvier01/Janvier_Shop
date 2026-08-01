-- Read-only public catalog. Prices remain outside of this table and are quoted after validation.
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "specifications" JSONB,
    "imageUrl" TEXT,
    "specialOrder" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");
CREATE INDEX "Product_status_updatedAt_idx" ON "Product"("status", "updatedAt");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
