"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { sendCustomerLifecycleEmail } from "@/lib/customer-accounts/enrollment";
import { database } from "@/lib/database";

const reviewInput = z.object({
  accountId: z.string().min(1),
  commercialDiscountPct: z
    .union([z.literal(""), z.coerce.number().min(0).max(100)])
    .transform((value) => (value === "" ? null : value)),
  decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "UPDATED"]),
  priceListCode: z.string().trim().max(80),
  reviewNotes: z.string().trim().max(4000)
});

export async function reviewCustomerAccount(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("No tienes permiso para aprobar cuentas comerciales.");
  }

  const parsed = reviewInput.safeParse({
    accountId: formData.get("accountId"),
    commercialDiscountPct: formData.get("commercialDiscountPct") ?? "",
    decision: formData.get("decision"),
    priceListCode: formData.get("priceListCode") ?? "",
    reviewNotes: formData.get("reviewNotes") ?? ""
  });
  if (!parsed.success) {
    return;
  }

  const reviewed = await database.$transaction(async (transaction) => {
    const account = await transaction.customerAccount.findUnique({
      include: { users: true },
      where: { id: parsed.data.accountId }
    });
    if (!account) {
      return null;
    }

    const now = new Date();
    const commercialTerms = {
      commercialDiscountPct: parsed.data.commercialDiscountPct,
      priceListCode: parsed.data.priceListCode || null,
      reviewNotes: parsed.data.reviewNotes || null,
      reviewedAt: now,
      reviewedById: admin.id
    };
    if (parsed.data.decision === "UPDATED") {
      if (account.status !== "APPROVED") {
        throw new Error("Aprueba la cuenta antes de guardar su condición comercial.");
      }
      await transaction.customerAccount.update({
        data: commercialTerms,
        where: { id: account.id }
      });
      return null;
    }

    if (parsed.data.decision === "APPROVED") {
      const owner = account.users.find(
        (user) => user.role === "OWNER" && user.emailVerifiedAt && user.passwordHash
      );
      if (!owner) {
        throw new Error("La cuenta debe confirmar su correo antes de aprobarse.");
      }

      const client = account.clientId
        ? { id: account.clientId }
        : ((await transaction.client.findFirst({
            select: { id: true },
            where: { email: owner.email }
          })) ??
          (await transaction.client.create({
            data: {
              companyName: account.companyName,
              contactName: account.contactName,
              email: owner.email,
              notes: "Cliente creado desde el registro comercial.",
              phone: account.contactPhone
            },
            select: { id: true }
          })));

      await transaction.customerAccount.update({
        data: {
          approvedAt: now,
          clientId: client.id,
          ...commercialTerms,
          rejectedAt: null,
          status: "APPROVED",
          suspendedAt: null
        },
        where: { id: account.id }
      });
      await transaction.customerUser.updateMany({
        data: { isActive: true },
        where: { accountId: account.id, emailVerifiedAt: { not: null } }
      });
      return {
        accountId: account.id,
        companyName: account.companyName,
        decision: parsed.data.decision,
        email: owner.email
      };
    }

    await transaction.customerAccount.update({
      data: {
        ...commercialTerms,
        ...(parsed.data.decision === "REJECTED"
          ? { rejectedAt: now }
          : { suspendedAt: now }),
        status: parsed.data.decision
      },
      where: { id: account.id }
    });
    await transaction.customerUser.updateMany({
      data: { isActive: false },
      where: { accountId: account.id }
    });
    const owner = account.users.find((user) => user.role === "OWNER");
    return owner
      ? {
          accountId: account.id,
          companyName: account.companyName,
          decision: parsed.data.decision,
          email: owner.email
        }
      : null;
  });

  if (reviewed) {
    const delivery = await sendCustomerLifecycleEmail(reviewed);
    if (delivery.error) {
      console.error("Customer lifecycle email delivery failed", {
        accountId: parsed.data.accountId,
        decision: parsed.data.decision,
        error: delivery.error
      });
    }
  }

  revalidatePath("/admin/clientes");
}
