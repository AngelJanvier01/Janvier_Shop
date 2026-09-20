CREATE TABLE "CustomerEnrollmentDocument" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "contentType" VARCHAR(120) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerEnrollmentDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerEnrollmentDocument_storageKey_key"
ON "CustomerEnrollmentDocument"("storageKey");

CREATE INDEX "CustomerEnrollmentDocument_accountId_createdAt_idx"
ON "CustomerEnrollmentDocument"("accountId", "createdAt");

ALTER TABLE "CustomerEnrollmentDocument"
ADD CONSTRAINT "CustomerEnrollmentDocument_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
