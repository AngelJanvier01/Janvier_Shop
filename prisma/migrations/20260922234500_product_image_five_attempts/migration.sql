ALTER TABLE "ProductImageDerivative"
  ADD COLUMN "failureNotifiedAt" TIMESTAMP(3),
  ALTER COLUMN "maxAttempts" SET DEFAULT 5;

UPDATE "ProductImageDerivative"
SET "maxAttempts" = 5
WHERE "maxAttempts" <> 5;

UPDATE "ProductImageDerivative"
SET "status" = 'RETRY'::"ProductImageProcessingStatus",
    "nextAttemptAt" = NOW(),
    "lockedAt" = NULL,
    "lockedBy" = NULL,
    "failureNotifiedAt" = NULL,
    "updatedAt" = NOW()
WHERE "status" = 'DEAD'::"ProductImageProcessingStatus"
  AND "attempts" < "maxAttempts";

CREATE INDEX "ProductImageDerivative_status_failureNotifiedAt_updatedAt_idx"
  ON "ProductImageDerivative"("status", "failureNotifiedAt", "updatedAt");
