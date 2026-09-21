-- Preserve the provider distinction between an approved payment and one that
-- has subsequently been partially refunded.
ALTER TYPE "CommerceOrderPaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED' BEFORE 'REFUNDED';
ALTER TYPE "CommercePaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED' BEFORE 'REFUNDED';
