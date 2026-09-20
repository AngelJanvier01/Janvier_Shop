"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCurrentCustomer } from "@/lib/auth/current-customer";
import {
  calculateSnapshotTotal,
  calculateSpeiTotals,
  CommercialPaymentError,
  getPaymentConfigurationView,
  isPaymentMethodAvailable,
  lockCommerceOrder,
  makeProviderIdempotencyKey,
  makeSpeiQuoteReference,
  synchronizeOrderPaymentState
} from "@/lib/commerce/payment-core";
import { issueSpeiQuotePdf } from "@/lib/commerce/spei-documents";
import { database } from "@/lib/database";

const createSpeiQuoteInput = z.object({
  bankAccountId: z.string().cuid(),
  orderReference: z.string().trim().min(8).max(48)
});

const reportSpeiPaymentInput = z.object({
  quoteReference: z.string().trim().min(8).max(48)
});

function paymentPath(orderReference: string, quoteReference?: string) {
  const search = quoteReference ? `?spei=${encodeURIComponent(quoteReference)}` : "";
  return `/suministro/pagos/${encodeURIComponent(orderReference)}${search}`;
}

function revalidatePayments(orderReference: string) {
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/pedidos");
  revalidatePath("/suministro/carrito");
  revalidatePath("/suministro/mi-cuenta");
  revalidatePath(`/suministro/pagos/${orderReference}`);
}

/** Creates an immutable SPEI quote from frozen order items. No client-supplied money is accepted. */
export async function issueSpeiQuote(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = createSpeiQuoteInput.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    orderReference: formData.get("orderReference")
  });
  if (!parsed.success) throw new Error("Selecciona una cuenta SPEI válida.");

  const issued = await database.$transaction(async (transaction) => {
    const now = new Date();
    const order = await transaction.commerceOrder.findFirst({
      include: {
        account: { select: { companyName: true, contactName: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            productId: true,
            quantity: true,
            snapshotBrand: true,
            snapshotName: true,
            snapshotSku: true,
            snapshotUnitPriceWithTax: true
          }
        }
      },
      where: {
        accountId: customer.accountId,
        reference: parsed.data.orderReference
      }
    });
    if (!order) throw new Error("El pedido no está disponible para esta cuenta.");
    await lockCommerceOrder(transaction, order.id);
    if (order.status !== "CONFIRMED") {
      throw new Error(
        "Primero debemos confirmar existencia, entrega y vigencia del pedido."
      );
    }
    if (order.paymentStatus === "PAID") {
      throw new Error("Este pedido ya cuenta con un pago confirmado.");
    }

    await transaction.commerceSpeiQuote.updateMany({
      data: { status: "EXPIRED" },
      where: {
        accountId: customer.accountId,
        expiresAt: { lte: now },
        orderId: order.id,
        status: { in: ["ISSUED", "AWAITING_PAYMENT", "PAYMENT_REPORTED"] }
      }
    });
    await transaction.commercePayment.updateMany({
      data: { status: "EXPIRED" },
      where: {
        orderId: order.id,
        provider: "SPEI",
        status: { in: ["AWAITING_PAYMENT", "PENDING"] },
        speiQuote: { expiresAt: { lte: now } }
      }
    });

    const [configuration, existing] = await Promise.all([
      transaction.commercePaymentConfiguration.findUnique({
        where: { installationKey: "default" }
      }),
      transaction.commerceSpeiQuote.findFirst({
        orderBy: { issuedAt: "desc" },
        select: { id: true, reference: true },
        where: {
          accountId: customer.accountId,
          expiresAt: { gt: now },
          orderId: order.id,
          status: { in: ["ISSUED", "AWAITING_PAYMENT", "PAYMENT_REPORTED"] }
        }
      })
    ]);
    const settings = getPaymentConfigurationView(configuration);
    if (!isPaymentMethodAvailable(settings, "SPEI")) {
      throw new Error("La transferencia SPEI no está habilitada actualmente.");
    }
    if (existing) return { ...existing, reused: true };
    const bankAccount = await transaction.commerceSpeiBankAccount.findFirst({
      where: {
        currency: "MXN",
        id: parsed.data.bankAccountId,
        isActive: true
      }
    });
    if (!bankAccount || (!bankAccount.clabe && !bankAccount.accountNumber)) {
      throw new Error("La cuenta SPEI elegida ya no está disponible.");
    }
    const subtotal = calculateSnapshotTotal(order.items);
    const totals = calculateSpeiTotals(subtotal, settings.speiDiscountPct);
    const reference = makeSpeiQuoteReference();
    const expiresAt = new Date(
      now.getTime() + settings.speiQuoteExpirationHours * 3_600_000
    );
    const quote = await transaction.commerceSpeiQuote.create({
      data: {
        accountId: customer.accountId,
        bankAccountId: bankAccount.id,
        bankAccountSnapshot: {
          accountNumber: bankAccount.accountNumber,
          accountType: bankAccount.accountType,
          alias: bankAccount.alias,
          bankName: bankAccount.bankName,
          beneficiary: bankAccount.beneficiary,
          clabe: bankAccount.clabe,
          currency: bankAccount.currency
        },
        customerCompanyName: order.account.companyName,
        customerContactName: customer.name || order.account.contactName,
        customerEmail: customer.email,
        discountAmount: totals.discountAmount,
        discountPercentage: settings.speiDiscountPct,
        expiresAt,
        issuedAt: now,
        issuedById: customer.id,
        items: {
          create: order.items.map((item) => {
            const unitPrice = Number(item.snapshotUnitPriceWithTax);
            return {
              brand: item.snapshotBrand,
              lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
              name: item.snapshotName,
              productId: item.productId,
              quantity: item.quantity,
              sku: item.snapshotSku,
              unitPrice
            };
          })
        },
        orderId: order.id,
        reference,
        sellerContact: settings.sellerContact,
        sellerName: settings.sellerName,
        sellerTerms: settings.sellerTerms,
        status: "AWAITING_PAYMENT",
        subtotal: totals.subtotal,
        total: totals.total,
        totalBeforeDiscount: totals.totalBeforeDiscount
      },
      select: { id: true, reference: true }
    });
    const payment = await transaction.commercePayment.create({
      data: {
        accountId: customer.accountId,
        amount: totals.total,
        events: {
          create: [
            {
              nextStatus: "AWAITING_PAYMENT",
              summary: "Cotización SPEI definitiva emitida.",
              type: "SPEI_QUOTE_ISSUED"
            },
            {
              nextStatus: "AWAITING_PAYMENT",
              summary: "Intento de pago SPEI creado.",
              type: "ATTEMPT_CREATED"
            }
          ]
        },
        externalReference: reference,
        expiresAt,
        idempotencyKey: makeProviderIdempotencyKey(),
        orderId: order.id,
        provider: "SPEI",
        requestedById: customer.id,
        speiQuoteId: quote.id,
        status: "AWAITING_PAYMENT"
      },
      select: { id: true }
    });
    await synchronizeOrderPaymentState(transaction, order.id);
    return {
      id: quote.id,
      paymentId: payment.id,
      reference: quote.reference,
      reused: false
    };
  });

  if (!issued.reused) {
    await issueSpeiQuotePdf(issued.id).catch(() => undefined);
  }
  revalidatePayments(parsed.data.orderReference);
  redirect(paymentPath(parsed.data.orderReference, issued.reference));
}

/** Customer declaration moves the transfer to review; it can never confirm a payment. */
export async function reportSpeiPayment(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = reportSpeiPaymentInput.safeParse({
    quoteReference: formData.get("quoteReference")
  });
  if (!parsed.success) throw new Error("No fue posible identificar la cotización SPEI.");

  const orderReference = await database.$transaction(async (transaction) => {
    const quote = await transaction.commerceSpeiQuote.findFirst({
      include: {
        order: { select: { reference: true } },
        payment: { select: { id: true, status: true } }
      },
      where: { accountId: customer.accountId, reference: parsed.data.quoteReference }
    });
    if (!quote) throw new Error("La cotización SPEI no pertenece a esta cuenta.");
    await lockCommerceOrder(transaction, quote.orderId);
    const now = new Date();
    if (quote.expiresAt <= now) {
      await transaction.commerceSpeiQuote.update({
        data: { status: "EXPIRED" },
        where: { id: quote.id }
      });
      if (quote.payment && quote.payment.status !== "APPROVED") {
        await transaction.commercePayment.update({
          data: { status: "EXPIRED" },
          where: { id: quote.payment.id }
        });
      }
      await synchronizeOrderPaymentState(transaction, quote.orderId);
      throw new CommercialPaymentError(
        "La cotización venció. Genera una nueva con precios vigentes."
      );
    }
    if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(quote.status)) {
      throw new Error("Esta cotización ya no admite reportes de transferencia.");
    }
    if (quote.status !== "PAYMENT_VERIFIED") {
      await transaction.commerceSpeiQuote.update({
        data: { paymentReportedAt: now, status: "PAYMENT_REPORTED" },
        where: { id: quote.id }
      });
      if (quote.payment && quote.payment.status !== "APPROVED") {
        await transaction.commercePayment.update({
          data: { reportedAt: now, status: "PENDING" },
          where: { id: quote.payment.id }
        });
        await transaction.commercePaymentEvent.create({
          data: {
            nextStatus: "PENDING",
            paymentId: quote.payment.id,
            previousStatus: quote.payment.status,
            summary: "El cliente reportó la transferencia; requiere conciliación.",
            type: "SPEI_PAYMENT_REPORTED"
          }
        });
      }
      await synchronizeOrderPaymentState(transaction, quote.orderId);
    }
    return quote.order.reference;
  });
  revalidatePayments(orderReference);
  redirect(paymentPath(orderReference, parsed.data.quoteReference));
}
