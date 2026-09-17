"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

const reviewInput = z.object({
  accountId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "SUSPENDED"])
});

export async function reviewCustomerAccount(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("No tienes permiso para aprobar cuentas comerciales.");
  }

  const parsed = reviewInput.safeParse({
    accountId: formData.get("accountId"),
    decision: formData.get("decision")
  });
  if (!parsed.success) {
    return;
  }

  await database.$transaction(async (transaction) => {
    const account = await transaction.customerAccount.findUnique({
      include: { users: true },
      where: { id: parsed.data.accountId }
    });
    if (!account) {
      return;
    }

    const now = new Date();
    if (parsed.data.decision === "APPROVED") {
      const owner = account.users.find(
        (user) => user.role === "OWNER" && user.emailVerifiedAt && user.passwordHash
      );
      if (!owner) {
        throw new Error("La cuenta debe confirmar su correo antes de aprobarse.");
      }

      const client =
        account.clientId
          ? { id: account.clientId }
          :
            (await transaction.client.findFirst({
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
            }));

      await transaction.customerAccount.update({
        data: {
          approvedAt: now,
          clientId: client.id,
          rejectedAt: null,
          reviewedAt: now,
          reviewedById: admin.id,
          status: "APPROVED",
          suspendedAt: null
        },
        where: { id: account.id }
      });
      await transaction.customerUser.updateMany({
        data: { isActive: true },
        where: { accountId: account.id, emailVerifiedAt: { not: null } }
      });
      return;
    }

    await transaction.customerAccount.update({
      data: {
        ...(parsed.data.decision === "REJECTED" ? { rejectedAt: now } : { suspendedAt: now }),
        reviewedAt: now,
        reviewedById: admin.id,
        status: parsed.data.decision
      },
      where: { id: account.id }
    });
    await transaction.customerUser.updateMany({
      data: { isActive: false },
      where: { accountId: account.id }
    });
  });

  revalidatePath("/admin/clientes");
}
