import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { Prisma } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

export const paymentConfigurationKey = "default";
export const paymentCurrency = "MXN";

export type PaymentConfigurationView = {
  mercadoPagoEnabled: boolean;
  mercadoPagoSandbox: boolean;
  paymentsEnabled: boolean;
  sellerContact: string | null;
  sellerName: string;
  sellerTerms: string | null;
  speiDiscountPct: number;
  speiEnabled: boolean;
  speiQuoteExpirationHours: number;
};

export type SnapshotPriceItem = {
  quantity: number;
  snapshotUnitPriceWithTax: Prisma.Decimal | number | null;
};

export class CommercialPaymentError extends Error {}

export function decimalToNumber(value: Prisma.Decimal | number | null) {
  return value === null ? null : Number(value);
}

/** Prices are read only from an already-issued order snapshot, never from Product. */
export function calculateSnapshotTotal(items: SnapshotPriceItem[]) {
  if (!items.length)
    throw new CommercialPaymentError("El pedido no tiene partidas cobrables.");
  let subtotal = 0;
  for (const item of items) {
    const unitPrice = decimalToNumber(item.snapshotUnitPriceWithTax);
    if (
      unitPrice === null ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new CommercialPaymentError(
        "Este pedido requiere validar sus precios antes de habilitar el pago."
      );
    }
    subtotal += unitPrice * item.quantity;
  }
  return Number(subtotal.toFixed(2));
}

export function calculateSpeiTotals(subtotal: number, discountPercentage: number) {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new CommercialPaymentError("El importe comercial no es válido.");
  }
  if (
    !Number.isFinite(discountPercentage) ||
    discountPercentage < 0 ||
    discountPercentage > 100
  ) {
    throw new CommercialPaymentError("El descuento SPEI configurado no es válido.");
  }
  const discountAmount = Number(((subtotal * discountPercentage) / 100).toFixed(2));
  return {
    discountAmount,
    subtotal: Number(subtotal.toFixed(2)),
    total: Number((subtotal - discountAmount).toFixed(2)),
    totalBeforeDiscount: Number(subtotal.toFixed(2))
  };
}

export function getPaymentConfigurationView(
  configuration: {
    mercadoPagoEnabled: boolean;
    mercadoPagoSandbox: boolean;
    paymentsEnabled: boolean;
    sellerContact: string | null;
    sellerName: string;
    sellerTerms: string | null;
    speiDiscountPct: Prisma.Decimal | number;
    speiEnabled: boolean;
    speiQuoteExpirationHours: number;
  } | null
): PaymentConfigurationView {
  return {
    mercadoPagoEnabled: configuration?.mercadoPagoEnabled ?? false,
    mercadoPagoSandbox: configuration?.mercadoPagoSandbox ?? true,
    paymentsEnabled: configuration?.paymentsEnabled ?? false,
    sellerContact: configuration?.sellerContact ?? null,
    sellerName: configuration?.sellerName ?? "JANVIER",
    sellerTerms: configuration?.sellerTerms ?? null,
    speiDiscountPct: Number(configuration?.speiDiscountPct ?? 0),
    speiEnabled: configuration?.speiEnabled ?? false,
    speiQuoteExpirationHours: configuration?.speiQuoteExpirationHours ?? 24
  };
}

export async function getPaymentConfiguration() {
  const configuration = await database.commercePaymentConfiguration.findUnique({
    where: { installationKey: paymentConfigurationKey }
  });
  return getPaymentConfigurationView(configuration);
}

export function isPaymentMethodAvailable(
  configuration: PaymentConfigurationView,
  method: "MERCADO_PAGO" | "SPEI"
) {
  return (
    configuration.paymentsEnabled &&
    (method === "MERCADO_PAGO"
      ? configuration.mercadoPagoEnabled
      : configuration.speiEnabled)
  );
}

export function makePaymentAttemptReference(orderReference: string) {
  const suffix = randomBytes(5).toString("hex").toUpperCase();
  return `PAY-${orderReference}-${suffix}`.slice(0, 64);
}

export function makeSpeiQuoteReference() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SPEI-${day}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function makeProviderIdempotencyKey() {
  return randomUUID();
}

export function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function lockCommerceOrder(
  transaction: Prisma.TransactionClient,
  orderId: string
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${orderId}, 0))`;
}

/** Keep the convenient order-level state consistent with the immutable attempt ledger. */
export async function synchronizeOrderPaymentState(
  transaction: Prisma.TransactionClient,
  orderId: string
) {
  const payments = await transaction.commercePayment.findMany({
    orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    select: { approvedAt: true, provider: true, status: true },
    where: { orderId }
  });
  const approved = payments.find((payment) => payment.status === "APPROVED");
  const top = approved ?? payments[0];
  const paymentStatus = approved
    ? "PAID"
    : top?.status === "PENDING"
      ? "PENDING"
      : top?.status === "AWAITING_PAYMENT" || top?.status === "DRAFT"
        ? "AWAITING_PAYMENT"
        : top?.status === "REFUNDED"
          ? "REFUNDED"
          : top?.status === "CHARGED_BACK"
            ? "CHARGED_BACK"
            : top?.status === "REJECTED" ||
                top?.status === "CANCELLED" ||
                top?.status === "EXPIRED"
              ? "REJECTED"
              : "UNPAID";
  await transaction.commerceOrder.update({
    data: {
      paidAt: approved?.approvedAt ?? null,
      paymentMethod: top?.provider ?? null,
      paymentStatus
    },
    where: { id: orderId }
  });
}

export function mapMercadoPagoOrderStatus(status: string | null | undefined) {
  switch (status?.toLowerCase()) {
    case "processed":
    case "approved":
      return "APPROVED" as const;
    case "failed":
    case "rejected":
      return "REJECTED" as const;
    case "cancelled":
      return "CANCELLED" as const;
    case "refunded":
      return "REFUNDED" as const;
    case "charged_back":
    case "charged-back":
      return "CHARGED_BACK" as const;
    default:
      return "PENDING" as const;
  }
}

export function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    APPROVED: "PAGO CONFIRMADO",
    AWAITING_PAYMENT: "EN ESPERA DE PAGO",
    CANCELLED: "CANCELADO",
    CHARGED_BACK: "CONTRACARGO",
    DRAFT: "PREPARANDO PAGO",
    EXPIRED: "VENCIDO",
    PENDING: "PAGO EN PROCESO",
    REJECTED: "PAGO RECHAZADO",
    REFUNDED: "REEMBOLSADO",
    UNPAID: "SIN PAGO"
  };
  return labels[status] ?? status;
}
