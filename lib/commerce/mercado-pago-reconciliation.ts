import { database } from "@/lib/database";

import {
  assertVerifiedMercadoPagoOrder,
  type MercadoPagoOrderResponse
} from "./mercado-pago";
import { lockCommerceOrder, synchronizeOrderPaymentState } from "./payment-core";

type ReconcileInput = {
  order: MercadoPagoOrderResponse;
  paymentId?: string;
  providerEventId?: string;
  source: "CHECKOUT" | "WEBHOOK";
};

/**
 * Persist the provider order as soon as Mercado Pago accepts the create call.
 *
 * The subsequent GET is deliberately authoritative, but it is a separate network
 * request. Saving this identifier first lets a webhook reconcile the attempt even
 * if that verification request times out, or the application restarts in between.
 */
export async function recordMercadoPagoOrderCreation(input: {
  order: MercadoPagoOrderResponse;
  paymentId: string;
}) {
  return database.$transaction(async (transaction) => {
    const payment = await transaction.commercePayment.findUnique({
      select: { id: true, orderId: true, providerOrderId: true, status: true },
      where: { id: input.paymentId }
    });
    if (!payment)
      throw new Error("No existe un intento local para la orden de Mercado Pago.");
    await lockCommerceOrder(transaction, payment.orderId);

    if (payment.providerOrderId && payment.providerOrderId !== input.order.id) {
      throw new Error(
        "El intento de pago ya estÃ¡ asociado a otra orden de Mercado Pago."
      );
    }

    await transaction.commercePayment.update({
      data: {
        providerOrderId: input.order.id,
        providerPaymentId: input.order.paymentId ?? undefined,
        providerStatus: input.order.status ?? "created",
        providerStatusDetail: input.order.statusDetail ?? undefined
      },
      where: { id: payment.id }
    });
    if (!payment.providerOrderId) {
      await transaction.commercePaymentEvent.create({
        data: {
          nextStatus: payment.status,
          paymentId: payment.id,
          previousStatus: payment.status,
          summary: "Orden de Mercado Pago creada; pendiente de verificaciÃ³n directa.",
          type: "PROVIDER_ORDER_CREATED"
        }
      });
    }
    return { orderId: payment.orderId, paymentId: payment.id };
  });
}

/** Only an order fetched from Mercado Pago can advance a card payment state. */
export async function reconcileMercadoPagoOrder(input: ReconcileInput) {
  return database.$transaction(async (transaction) => {
    const payment = await transaction.commercePayment.findFirst({
      select: {
        amount: true,
        externalReference: true,
        id: true,
        orderId: true,
        providerOrderId: true,
        status: true
      },
      where: {
        provider: "MERCADO_PAGO",
        ...(input.paymentId
          ? { id: input.paymentId }
          : { providerOrderId: input.order.id })
      }
    });
    if (!payment)
      throw new Error("No existe un intento local para la orden de Mercado Pago.");
    await lockCommerceOrder(transaction, payment.orderId);
    const nextStatus = assertVerifiedMercadoPagoOrder({
      amount: Number(payment.amount),
      expectedExternalReference: payment.externalReference,
      order: input.order
    });
    const now = new Date();
    await transaction.commercePayment.update({
      data: {
        approvedAt: nextStatus === "APPROVED" ? now : undefined,
        chargedBackAt: nextStatus === "CHARGED_BACK" ? now : undefined,
        lastWebhookAt: input.source === "WEBHOOK" ? now : undefined,
        providerOrderId: input.order.id,
        providerPaymentId: input.order.paymentId ?? undefined,
        providerStatus: input.order.status ?? "unknown",
        providerStatusDetail: input.order.statusDetail ?? undefined,
        refundedAt:
          nextStatus === "REFUNDED" || nextStatus === "PARTIALLY_REFUNDED"
            ? now
            : undefined,
        rejectedAt: nextStatus === "REJECTED" ? now : undefined,
        status: nextStatus
      },
      where: { id: payment.id }
    });
    if (payment.status !== nextStatus || input.providerEventId) {
      await transaction.commercePaymentEvent.create({
        data: {
          nextStatus,
          paymentId: payment.id,
          previousStatus: payment.status,
          providerEventId: input.providerEventId,
          summary:
            input.source === "WEBHOOK"
              ? "Estado verificado desde notificación autenticada de Mercado Pago."
              : "Estado verificado directamente con Mercado Pago.",
          type:
            input.source === "WEBHOOK" ? "WEBHOOK_RECEIVED" : "PROVIDER_STATUS_VERIFIED"
        }
      });
    }
    await synchronizeOrderPaymentState(transaction, payment.orderId);
    return { orderId: payment.orderId, paymentId: payment.id, status: nextStatus };
  });
}
