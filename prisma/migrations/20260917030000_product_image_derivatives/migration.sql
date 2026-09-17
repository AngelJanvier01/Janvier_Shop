CREATE TYPE "ProductImageProcessingStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'READY',
  'APPROVED',
  'REJECTED',
  'DEAD'
);

CREATE TABLE "ProductImageDerivative" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sourceUrl" VARCHAR(2048) NOT NULL,
  "sourceUrlHash" CHAR(64) NOT NULL,
  "sourcePosition" INTEGER NOT NULL DEFAULT 0,
  "sourceHash" CHAR(64),
  "sourceEtag" VARCHAR(255),
  "sourceModifiedAt" VARCHAR(255),
  "status" "ProductImageProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" VARCHAR(120),
  "modelName" VARCHAR(160),
  "modelRevision" VARCHAR(160),
  "processingVersion" INTEGER NOT NULL DEFAULT 1,
  "storageKey" VARCHAR(512),
  "pngBytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "processedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "lastErrorCode" VARCHAR(80),
  "lastErrorMessage" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductImageDerivative_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImageDerivative_productId_sourceUrlHash_key"
  ON "ProductImageDerivative"("productId", "sourceUrlHash");
CREATE INDEX "ProductImageDerivative_status_nextAttemptAt_createdAt_idx"
  ON "ProductImageDerivative"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "ProductImageDerivative_productId_status_sourcePosition_idx"
  ON "ProductImageDerivative"("productId", "status", "sourcePosition");
CREATE INDEX "ProductImageDerivative_reviewedById_idx"
  ON "ProductImageDerivative"("reviewedById");

ALTER TABLE "ProductImageDerivative"
  ADD CONSTRAINT "ProductImageDerivative_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductImageDerivative"
  ADD CONSTRAINT "ProductImageDerivative_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
