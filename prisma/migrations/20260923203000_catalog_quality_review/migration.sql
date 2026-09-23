ALTER TABLE "Product"
  ADD COLUMN "manualCatalogFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "catalogReviewApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "catalogReviewNote" VARCHAR(1000),
  ADD COLUMN "catalogReviewedAt" TIMESTAMP(3);
