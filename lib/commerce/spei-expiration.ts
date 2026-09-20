import { database } from "@/lib/database";

import { lockCommerceOrder, synchronizeOrderPaymentState } from "./payment-core";

const activeSpeiQuoteStatuses = [
  "ISSUED",
  "AWAITING_PAYMENT",
  "PAYMENT_REPORTED"
] as const;

/**
 * Expires immutable SPEI quotes in small locked batches. It is safe to invoke
 * repeatedly from the operations worker: only the first worker that locks an
 * order performs the transition and creates its ledger event.
 */
export async function expireDueSpeiQuotes(limit = 100, now = new Date()) {
  const candidates = await database.commerceSpeiQuote.findMany({
    orderBy: { expiresAt: "asc" },
    select: { id: true, orderId: true },
    take: Math.min(Math.max(limit, 1), 500),
    where: {
      expiresAt: { lte: now },
      status: { in: [...activeSpeiQuoteStatuses] }
    }
  });
  let expired = 0;

  for (const candidate of candidates) {
    const didExpire = await database.$transaction(async (transaction) => {
      await lockCommerceOrder(transaction, candidate.orderId);
      const quote = await transaction.commerceSpeiQuote.findUnique({
        include: { payment: { select: { id: true, status: true } } },
        where: { id: candidate.id }
      });
      if (
        !quote ||
        quote.expiresAt > now ||
        !activeSpeiQuoteStatuses.includes(
          quote.status as (typeof activeSpeiQuoteStatuses)[number]
        ) ||
        quote.payment?.status === "APPROVED"
      ) {
        return false;
      }

      await transaction.commerceSpeiQuote.update({
        data: { status: "EXPIRED" },
        where: { id: quote.id }
      });
      if (quote.payment && quote.payment.status !== "EXPIRED") {
        await transaction.commercePayment.update({
          data: { status: "EXPIRED" },
          where: { id: quote.payment.id }
        });
        await transaction.commercePaymentEvent.create({
          data: {
            nextStatus: "EXPIRED",
            paymentId: quote.payment.id,
            previousStatus: quote.payment.status,
            summary: "CotizaciÃ³n SPEI vencida automÃ¡ticamente.",
            type: "EXPIRED"
          }
        });
      }
      await synchronizeOrderPaymentState(transaction, quote.orderId);
      return true;
    });
    if (didExpire) expired += 1;
  }

  return { considered: candidates.length, expired };
}
