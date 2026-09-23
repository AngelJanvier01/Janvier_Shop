-- Exact SICODD URLs and UPCs represent a single catalog item. PostgreSQL
-- permits multiple NULLs in these indexes for manually created products.
CREATE UNIQUE INDEX "Product_upc_key" ON "Product"("upc");
CREATE UNIQUE INDEX "Product_supplierSourceUrl_key" ON "Product"("supplierSourceUrl");
