"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import {
  customerEmailDeliveryIsConfigured,
  sendCustomerCommerceEmail
} from "@/lib/customer-accounts/enrollment";
import { database } from "@/lib/database";

const orderReviewInput = z.object({
  adminNotes: z.string().trim().max(4000),
  orderId: z.string().cuid(),
  status: z.enum(["REQUESTED", "REVIEWING", "CONFIRMED", "FULFILLED", "CANCELLED"])
});

export async function reviewCommerceOrder(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("No tienes permiso para modificar pedidos comerciales.");
  }

  const parsed = orderReviewInput.safeParse({
    adminNotes: formData.get("adminNotes") ?? "",
    orderId: formData.get("orderId"),
    status: formData.get("status")
  });
  if (!parsed.success) {
    throw new Error("Revisa el estado y las notas del pedido.");
  }

  const previous = await database.commerceOrder.findUnique({
    select: { status: true },
    where: { id: parsed.data.orderId }
  });
  const now = new Date();
  const statusDates = {
    ...(parsed.data.status === "REVIEWING" ? { reviewedAt: now } : {}),
    ...(parsed.data.status === "CONFIRMED" ? { confirmedAt: now, reviewedAt: now } : {}),
    ...(parsed.data.status === "FULFILLED" ? { fulfilledAt: now, reviewedAt: now } : {}),
    ...(parsed.data.status === "CANCELLED" ? { cancelledAt: now, reviewedAt: now } : {})
  };
  const order = await database.commerceOrder.update({
    data: {
      adminNotes: parsed.data.adminNotes || null,
      reviewedById: admin.id,
      status: parsed.data.status,
      ...statusDates
    },
    select: {
      account: {
        select: {
          companyName: true,
          id: true,
          users: {
            orderBy: { createdAt: "asc" },
            select: { email: true },
            take: 1,
            where: { role: "OWNER" }
          }
        }
      },
      reference: true,
      status: true
    },
    where: { id: parsed.data.orderId }
  });

  revalidatePath("/admin/pedidos");
  revalidatePath("/suministro/mi-cuenta");
  revalidatePath("/suministro/carrito");
  const ownerEmail = order.account.users[0]?.email;
  if (
    previous?.status !== order.status &&
    ownerEmail &&
    (await customerEmailDeliveryIsConfigured())
  ) {
    after(async () => {
      const delivery = await sendCustomerCommerceEmail({
        accountId: order.account.id,
        companyName: order.account.companyName,
        email: ownerEmail,
        reference: order.reference,
        status: order.status,
        type: "ORDER_STATUS"
      });
      if (delivery.error) {
        console.error("Customer order status email failed", {
          error: delivery.error,
          reference: order.reference
        });
      }
    });
  }
}
