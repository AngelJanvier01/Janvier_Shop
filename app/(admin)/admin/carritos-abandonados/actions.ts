"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

const recoveryInput = z.object({
  adminNotes: z.string().trim().max(2000),
  cartId: z.string().cuid(),
  returnTo: z.string().trim().max(800).optional(),
  status: z.enum(["OPEN", "CONTACTED", "DISMISSED"])
});

function recoveryReturnPath(
  value: string | undefined,
  status: "OPEN" | "CONTACTED" | "DISMISSED"
) {
  const fallback = "/admin/carritos-abandonados";
  if (!value?.startsWith(fallback)) {
    return `${fallback}?status=${status}&saved=1`;
  }
  const url = new URL(value, "https://janvier.local");
  if (url.origin !== "https://janvier.local" || url.pathname !== fallback) {
    return `${fallback}?status=${status}&saved=1`;
  }
  url.searchParams.set("status", status);
  url.searchParams.set("saved", "1");
  return `${url.pathname}${url.search}`;
}

export async function updateAbandonedCartRecovery(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("No tienes permiso para gestionar recuperaciones comerciales.");
  }
  const parsed = recoveryInput.safeParse({
    adminNotes: formData.get("adminNotes") ?? "",
    cartId: formData.get("cartId"),
    returnTo: formData.get("returnTo") ?? undefined,
    status: formData.get("status")
  });
  if (!parsed.success) {
    throw new Error("Revisa el estado y la nota de seguimiento.");
  }
  const cart = await database.commerceCart.findFirst({
    select: { id: true },
    where: { id: parsed.data.cartId, status: "ACTIVE" }
  });
  if (!cart) {
    throw new Error("Este carrito ya no está disponible para recuperación.");
  }
  const now = new Date();
  const statusDates = {
    ...(parsed.data.status === "CONTACTED"
      ? { lastContactedAt: now, lastContactedById: admin.id }
      : {}),
    ...(parsed.data.status === "DISMISSED" ? { dismissedAt: now } : {}),
    ...(parsed.data.status === "OPEN" ? { dismissedAt: null } : {})
  };
  await database.commerceCartRecovery.upsert({
    create: {
      adminNotes: parsed.data.adminNotes || null,
      cartId: cart.id,
      status: parsed.data.status,
      ...statusDates
    },
    update: {
      adminNotes: parsed.data.adminNotes || null,
      status: parsed.data.status,
      ...statusDates
    },
    where: { cartId: cart.id }
  });
  revalidatePath("/admin/carritos-abandonados");
  redirect(recoveryReturnPath(parsed.data.returnTo, parsed.data.status));
}
