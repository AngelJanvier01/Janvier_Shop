-- CreateEnum
CREATE TYPE "CommerceOrderPaymentStatus" AS ENUM ('UNPAID', 'AWAITING_PAYMENT', 'PENDING', 'PAID', 'REJECTED', 'REFUNDED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "CommercePaymentProvider" AS ENUM ('MERCADO_PAGO', 'SPEI');

-- CreateEnum
CREATE TYPE "CommercePaymentStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "CommercePaymentEventType" AS ENUM ('ATTEMPT_CREATED', 'PROVIDER_ORDER_CREATED', 'PROVIDER_STATUS_VERIFIED', 'WEBHOOK_RECEIVED', 'SPEI_QUOTE_ISSUED', 'SPEI_PAYMENT_REPORTED', 'SPEI_PAYMENT_CONFIRMED', 'SPEI_PAYMENT_REJECTED', 'EXPIRED', 'REFUND_RECORDED');

-- CreateEnum
CREATE TYPE "CommerceSpeiQuoteStatus" AS ENUM ('ISSUED', 'AWAITING_PAYMENT', 'PAYMENT_REPORTED', 'PAYMENT_VERIFIED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditEventType" ADD VALUE 'PAYMENT_SETTINGS_OPENED';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'PAYMENT_SETTINGS_UPDATED';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'SPEI_BANK_ACCOUNT_CREATED';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'SPEI_BANK_ACCOUNT_UPDATED';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'SPEI_PAYMENT_CONFIRMED';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'SPEI_PAYMENT_REJECTED';

-- AlterTable
ALTER TABLE "CommerceOrder" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "CommercePaymentProvider",
ADD COLUMN     "paymentStatus" "CommerceOrderPaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "CommercePaymentConfiguration" (
    "id" TEXT NOT NULL,
    "installationKey" VARCHAR(32) NOT NULL DEFAULT 'default',
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mercadoPagoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mercadoPagoSandbox" BOOLEAN NOT NULL DEFAULT true,
    "speiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "speiDiscountPct" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "speiQuoteExpirationHours" INTEGER NOT NULL DEFAULT 24,
    "sellerName" VARCHAR(160) NOT NULL DEFAULT 'JANVIER',
    "sellerContact" VARCHAR(320),
    "sellerTerms" VARCHAR(2000),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercePaymentConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSpeiBankAccount" (
    "id" TEXT NOT NULL,
    "alias" VARCHAR(80) NOT NULL,
    "bankName" VARCHAR(120) NOT NULL,
    "beneficiary" VARCHAR(160) NOT NULL,
    "accountNumber" VARCHAR(40),
    "clabe" VARCHAR(18),
    "accountType" VARCHAR(40) NOT NULL DEFAULT 'CUENTA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSpeiBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercePayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "requestedById" TEXT,
    "speiQuoteId" TEXT,
    "provider" "CommercePaymentProvider" NOT NULL,
    "status" "CommercePaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
    "externalReference" VARCHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "providerOrderId" VARCHAR(160),
    "providerPaymentId" VARCHAR(160),
    "providerStatus" VARCHAR(80),
    "providerStatusDetail" VARCHAR(160),
    "paymentMethodId" VARCHAR(80),
    "paymentMethodType" VARCHAR(80),
    "expiresAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "chargedBackAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNotes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSpeiQuote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "issuedById" TEXT,
    "bankAccountId" TEXT NOT NULL,
    "reference" VARCHAR(48) NOT NULL,
    "status" "CommerceSpeiQuoteStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
    "subtotal" DECIMAL(14,2) NOT NULL,
    "totalBeforeDiscount" DECIMAL(14,2) NOT NULL,
    "discountPercentage" DECIMAL(9,4) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "sellerName" VARCHAR(160) NOT NULL,
    "sellerContact" VARCHAR(320),
    "sellerTerms" VARCHAR(2000),
    "customerCompanyName" VARCHAR(160) NOT NULL,
    "customerContactName" VARCHAR(160) NOT NULL,
    "customerEmail" VARCHAR(320) NOT NULL,
    "bankAccountSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentReportedAt" TIMESTAMP(3),
    "paymentVerifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "pdfStorageKey" VARCHAR(512),
    "pdfSha256" CHAR(64),
    "pdfGeneratedAt" TIMESTAMP(3),
    "pdfGenerationError" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSpeiQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSpeiQuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "name" VARCHAR(1000),
    "sku" VARCHAR(80),
    "brand" VARCHAR(100),
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceSpeiQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceSpeiPaymentProof" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceSpeiPaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercePaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" "CommercePaymentEventType" NOT NULL,
    "previousStatus" "CommercePaymentStatus",
    "nextStatus" "CommercePaymentStatus",
    "providerEventId" VARCHAR(200),
    "summary" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercePaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercePaymentWebhook" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" "CommercePaymentProvider" NOT NULL,
    "deliveryKey" VARCHAR(200) NOT NULL,
    "resourceId" VARCHAR(160) NOT NULL,
    "topic" VARCHAR(80),
    "action" VARCHAR(160),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" VARCHAR(500),

    CONSTRAINT "CommercePaymentWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercePaymentConfiguration_installationKey_key" ON "CommercePaymentConfiguration"("installationKey");

-- CreateIndex
CREATE INDEX "CommerceSpeiBankAccount_isActive_priority_idx" ON "CommerceSpeiBankAccount"("isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceSpeiBankAccount_alias_currency_key" ON "CommerceSpeiBankAccount"("alias", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePayment_speiQuoteId_key" ON "CommercePayment"("speiQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePayment_externalReference_key" ON "CommercePayment"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePayment_idempotencyKey_key" ON "CommercePayment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePayment_providerOrderId_key" ON "CommercePayment"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePayment_providerPaymentId_key" ON "CommercePayment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "CommercePayment_orderId_status_createdAt_idx" ON "CommercePayment"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommercePayment_accountId_status_updatedAt_idx" ON "CommercePayment"("accountId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CommercePayment_provider_status_updatedAt_idx" ON "CommercePayment"("provider", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CommercePayment_status_expiresAt_idx" ON "CommercePayment"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceSpeiQuote_reference_key" ON "CommerceSpeiQuote"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceSpeiQuote_pdfStorageKey_key" ON "CommerceSpeiQuote"("pdfStorageKey");

-- CreateIndex
CREATE INDEX "CommerceSpeiQuote_orderId_status_issuedAt_idx" ON "CommerceSpeiQuote"("orderId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "CommerceSpeiQuote_accountId_status_updatedAt_idx" ON "CommerceSpeiQuote"("accountId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CommerceSpeiQuote_status_expiresAt_idx" ON "CommerceSpeiQuote"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CommerceSpeiQuoteItem_productId_idx" ON "CommerceSpeiQuoteItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceSpeiQuoteItem_quoteId_productId_key" ON "CommerceSpeiQuoteItem"("quoteId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceSpeiPaymentProof_storageKey_key" ON "CommerceSpeiPaymentProof"("storageKey");

-- CreateIndex
CREATE INDEX "CommerceSpeiPaymentProof_quoteId_createdAt_idx" ON "CommerceSpeiPaymentProof"("quoteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePaymentEvent_providerEventId_key" ON "CommercePaymentEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "CommercePaymentEvent_paymentId_createdAt_idx" ON "CommercePaymentEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "CommercePaymentEvent_type_createdAt_idx" ON "CommercePaymentEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommercePaymentWebhook_deliveryKey_key" ON "CommercePaymentWebhook"("deliveryKey");

-- CreateIndex
CREATE INDEX "CommercePaymentWebhook_provider_receivedAt_idx" ON "CommercePaymentWebhook"("provider", "receivedAt");

-- CreateIndex
CREATE INDEX "CommercePaymentWebhook_paymentId_receivedAt_idx" ON "CommercePaymentWebhook"("paymentId", "receivedAt");

-- CreateIndex
CREATE INDEX "CommerceOrder_accountId_paymentStatus_updatedAt_idx" ON "CommerceOrder"("accountId", "paymentStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "CommerceOrder_paymentStatus_updatedAt_idx" ON "CommerceOrder"("paymentStatus", "updatedAt");

-- AddForeignKey
ALTER TABLE "CommercePaymentConfiguration" ADD CONSTRAINT "CommercePaymentConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiBankAccount" ADD CONSTRAINT "CommerceSpeiBankAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_speiQuoteId_fkey" FOREIGN KEY ("speiQuoteId") REFERENCES "CommerceSpeiQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuote" ADD CONSTRAINT "CommerceSpeiQuote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuote" ADD CONSTRAINT "CommerceSpeiQuote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuote" ADD CONSTRAINT "CommerceSpeiQuote_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuote" ADD CONSTRAINT "CommerceSpeiQuote_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CommerceSpeiBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuote" ADD CONSTRAINT "CommerceSpeiQuote_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuoteItem" ADD CONSTRAINT "CommerceSpeiQuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CommerceSpeiQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiQuoteItem" ADD CONSTRAINT "CommerceSpeiQuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiPaymentProof" ADD CONSTRAINT "CommerceSpeiPaymentProof_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CommerceSpeiQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceSpeiPaymentProof" ADD CONSTRAINT "CommerceSpeiPaymentProof_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePaymentEvent" ADD CONSTRAINT "CommercePaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercePaymentWebhook" ADD CONSTRAINT "CommercePaymentWebhook_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CommercePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
