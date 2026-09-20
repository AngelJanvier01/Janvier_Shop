"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin, requireSettingsAdmin } from "@/lib/auth/current-admin";
import {
  lockCommerceOrder,
  synchronizeOrderPaymentState
} from "@/lib/commerce/payment-core";
import { database } from "@/lib/database";

const paymentReviewInput = z.object({
  action: z.enum(["CONFIRM", "REJECT", "REQUEST_REVIEW", "CANCEL"]),
  notes: z.string().trim().max(2000),
  paymentId: z.string().cuid()
});

const paymentSettingsInput = z.object({
  mercadoPagoEnabled: z.boolean(),
  mercadoPagoSandbox: z.boolean(),
  paymentsEnabled: z.boolean(),
  sellerContact: z.string().trim().max(320),
  sellerName: z.string().trim().min(2).max(160),
  sellerTerms: z.string().trim().max(2000),
  speiDiscountPct: z.coerce.number().min(0).max(25),
  speiEnabled: z.boolean(),
  speiQuoteExpirationHours: z.coerce.number().int().min(1).max(168)
});

const bankAccountInput = z.object({
  accountNumber: z.string().trim().max(40),
  accountType: z.string().trim().min(2).max(40),
  alias: z.string().trim().min(2).max(80),
  bankName: z.string().trim().min(2).max(120),
  beneficiary: z.string().trim().min(2).max(160),
  clabe: z.string().trim().max(18),
  currency: z.literal("MXN"),
  isActive: z.boolean(),
  priority: z.coerce.number().int().min(-999).max(999)
});

function revalidatePaymentSurfaces() {
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/ajustes/pagos");
  revalidatePath("/suministro/mi-cuenta");
  revalidatePath("/suministro/carrito");
}

export async function reviewSpeiPayment(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR")
    throw new Error("No tienes permiso para conciliar transferencias.");
  const parsed = paymentReviewInput.safeParse({
    action: formData.get("action"),
    notes: formData.get("notes") ?? "",
    paymentId: formData.get("paymentId")
  });
  if (!parsed.success) throw new Error("Revisa la acción de conciliación.");

  const result = await database.$transaction(async (transaction) => {
    const payment = await transaction.commercePayment.findFirst({
      include: {
        speiQuote: { select: { id: true, status: true } },
        order: { select: { id: true, reference: true } }
      },
      where: { id: parsed.data.paymentId, provider: "SPEI" }
    });
    if (!payment?.speiQuote) throw new Error("El pago SPEI ya no está disponible.");
    await lockCommerceOrder(transaction, payment.order.id);
    const now = new Date();
    if (parsed.data.action === "CONFIRM") {
      const anotherApproved = await transaction.commercePayment.findFirst({
        select: { id: true },
        where: { id: { not: payment.id }, orderId: payment.order.id, status: "APPROVED" }
      });
      if (anotherApproved)
        throw new Error("Este pedido ya cuenta con otro pago confirmado.");
      if (payment.status !== "APPROVED") {
        await transaction.commercePayment.update({
          data: {
            approvedAt: now,
            reviewNotes: parsed.data.notes || null,
            reviewedById: admin.id,
            status: "APPROVED"
          },
          where: { id: payment.id }
        });
        await transaction.commercePaymentEvent.create({
          data: {
            nextStatus: "APPROVED",
            paymentId: payment.id,
            previousStatus: payment.status,
            summary: "Transferencia SPEI confirmada manualmente.",
            type: "SPEI_PAYMENT_CONFIRMED"
          }
        });
      }
      await transaction.commerceSpeiQuote.update({
        data: {
          paymentVerifiedAt: now,
          status: "PAYMENT_VERIFIED",
          verifiedById: admin.id
        },
        where: { id: payment.speiQuote.id }
      });
    } else if (parsed.data.action === "REJECT") {
      if (payment.status === "APPROVED")
        throw new Error("Un pago confirmado requiere proceso de reembolso, no rechazo.");
      await transaction.commercePayment.update({
        data: {
          rejectedAt: now,
          reviewNotes: parsed.data.notes || "Comprobante rechazado.",
          reviewedById: admin.id,
          status: "REJECTED"
        },
        where: { id: payment.id }
      });
      await transaction.commercePaymentEvent.create({
        data: {
          nextStatus: "REJECTED",
          paymentId: payment.id,
          previousStatus: payment.status,
          summary: "Comprobante SPEI rechazado; se requiere una nueva cotización.",
          type: "SPEI_PAYMENT_REJECTED"
        }
      });
      await transaction.commerceSpeiQuote.update({
        data: { cancelledAt: now, status: "CANCELLED" },
        where: { id: payment.speiQuote.id }
      });
    } else if (parsed.data.action === "CANCEL") {
      if (payment.status === "APPROVED")
        throw new Error("Un pago confirmado no puede cancelarse.");
      await transaction.commercePayment.update({
        data: {
          reviewNotes: parsed.data.notes || "Cotización cancelada por operación.",
          reviewedById: admin.id,
          status: "CANCELLED"
        },
        where: { id: payment.id }
      });
      await transaction.commerceSpeiQuote.update({
        data: { cancelledAt: now, status: "CANCELLED" },
        where: { id: payment.speiQuote.id }
      });
    } else {
      if (payment.status === "APPROVED") throw new Error("El pago ya fue confirmado.");
      await transaction.commercePayment.update({
        data: {
          reviewNotes: parsed.data.notes || null,
          reviewedById: admin.id,
          status: "PENDING"
        },
        where: { id: payment.id }
      });
      await transaction.commerceSpeiQuote.update({
        data: { status: "PAYMENT_REPORTED" },
        where: { id: payment.speiQuote.id }
      });
    }
    await synchronizeOrderPaymentState(transaction, payment.order.id);
    return payment.order.reference;
  });

  await database.adminAuditEvent.create({
    data: {
      type:
        parsed.data.action === "CONFIRM"
          ? "SPEI_PAYMENT_CONFIRMED"
          : "SPEI_PAYMENT_REJECTED",
      userId: admin.id
    }
  });
  revalidatePaymentSurfaces();
  revalidatePath(`/suministro/pagos/${result}`);
}

export async function updatePaymentSettings(formData: FormData) {
  const { admin } = await requireSettingsAdmin();
  const parsed = paymentSettingsInput.safeParse({
    mercadoPagoEnabled: formData.get("mercadoPagoEnabled") === "on",
    mercadoPagoSandbox: formData.get("mercadoPagoSandbox") === "on",
    paymentsEnabled: formData.get("paymentsEnabled") === "on",
    sellerContact: formData.get("sellerContact") ?? "",
    sellerName: formData.get("sellerName") ?? "",
    sellerTerms: formData.get("sellerTerms") ?? "",
    speiDiscountPct: formData.get("speiDiscountPct"),
    speiEnabled: formData.get("speiEnabled") === "on",
    speiQuoteExpirationHours: formData.get("speiQuoteExpirationHours")
  });
  if (!parsed.success) throw new Error("Revisa los ajustes comerciales del cobro.");
  await database.commercePaymentConfiguration.upsert({
    create: {
      ...parsed.data,
      installationKey: "default",
      sellerContact: parsed.data.sellerContact || null,
      sellerTerms: parsed.data.sellerTerms || null,
      updatedById: admin.id
    },
    update: {
      ...parsed.data,
      sellerContact: parsed.data.sellerContact || null,
      sellerTerms: parsed.data.sellerTerms || null,
      updatedById: admin.id
    },
    where: { installationKey: "default" }
  });
  await database.adminAuditEvent.create({
    data: { type: "PAYMENT_SETTINGS_UPDATED", userId: admin.id }
  });
  revalidatePaymentSurfaces();
}

export async function createSpeiBankAccount(formData: FormData) {
  const { admin } = await requireSettingsAdmin();
  const parsed = bankAccountInput.safeParse({
    accountNumber: formData.get("accountNumber") ?? "",
    accountType: formData.get("accountType") ?? "",
    alias: formData.get("alias") ?? "",
    bankName: formData.get("bankName") ?? "",
    beneficiary: formData.get("beneficiary") ?? "",
    clabe: formData.get("clabe") ?? "",
    currency: "MXN",
    isActive: formData.get("isActive") === "on",
    priority: formData.get("priority")
  });
  if (!parsed.success) throw new Error("Revisa los datos de la cuenta bancaria.");
  const clabe = parsed.data.clabe.replaceAll(" ", "");
  const accountNumber = parsed.data.accountNumber.replaceAll(" ", "");
  if (!clabe && !accountNumber) throw new Error("Indica CLABE o número de cuenta.");
  if (clabe && !/^\d{18}$/u.test(clabe))
    throw new Error("La CLABE debe tener 18 dígitos.");
  if (accountNumber && !/^\d{6,40}$/u.test(accountNumber)) {
    throw new Error("El número de cuenta sólo debe contener entre 6 y 40 dígitos.");
  }
  await database.commerceSpeiBankAccount.create({
    data: {
      ...parsed.data,
      accountNumber: accountNumber || null,
      clabe: clabe || null,
      updatedById: admin.id
    }
  });
  await database.adminAuditEvent.create({
    data: { type: "SPEI_BANK_ACCOUNT_CREATED", userId: admin.id }
  });
  revalidatePaymentSurfaces();
}

export async function updateSpeiBankAccount(formData: FormData) {
  const { admin } = await requireSettingsAdmin();
  const accountId = z.string().cuid().safeParse(formData.get("accountId"));
  if (!accountId.success)
    throw new Error("No fue posible identificar la cuenta bancaria.");
  const parsed = bankAccountInput.safeParse({
    accountNumber: formData.get("accountNumber") ?? "",
    accountType: formData.get("accountType") ?? "",
    alias: formData.get("alias") ?? "",
    bankName: formData.get("bankName") ?? "",
    beneficiary: formData.get("beneficiary") ?? "",
    clabe: formData.get("clabe") ?? "",
    currency: "MXN",
    isActive: formData.get("isActive") === "on",
    priority: formData.get("priority")
  });
  if (!parsed.success) throw new Error("Revisa los datos de la cuenta bancaria.");
  const clabe = parsed.data.clabe.replaceAll(" ", "");
  const accountNumber = parsed.data.accountNumber.replaceAll(" ", "");
  if (!clabe && !accountNumber) throw new Error("Indica CLABE o número de cuenta.");
  if (clabe && !/^\d{18}$/u.test(clabe))
    throw new Error("La CLABE debe tener 18 dígitos.");
  if (accountNumber && !/^\d{6,40}$/u.test(accountNumber)) {
    throw new Error("El número de cuenta sólo debe contener entre 6 y 40 dígitos.");
  }
  await database.commerceSpeiBankAccount.update({
    data: {
      ...parsed.data,
      accountNumber: accountNumber || null,
      clabe: clabe || null,
      updatedById: admin.id
    },
    where: { id: accountId.data }
  });
  await database.adminAuditEvent.create({
    data: { type: "SPEI_BANK_ACCOUNT_UPDATED", userId: admin.id }
  });
  revalidatePaymentSurfaces();
}
