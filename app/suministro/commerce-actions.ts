"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCurrentCustomer } from "@/lib/auth/current-customer";
import { database } from "@/lib/database";

const cartItemInput = z.object({
  productId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(999)
});

const cartItemIdInput = z.object({
  cartItemId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(999)
});

const removeCartItemInput = z.object({
  cartItemId: z.string().cuid()
});

const quoteInput = z.object({
  customerNotes: z.string().trim().max(2000)
});

function quoteReference() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `COT-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function getOrCreateActiveCart(accountId: string) {
  const existing = await database.commerceCart.findFirst({
    orderBy: { updatedAt: "desc" },
    where: { accountId, status: "ACTIVE" }
  });
  if (existing) return existing;
  return database.commerceCart.create({ data: { accountId } });
}

export async function addProductToCart(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = cartItemInput.safeParse({
    productId: formData.get("productId"),
    quantity: formData.get("quantity")
  });
  if (!parsed.success) {
    throw new Error("No fue posible agregar este producto a la cotización.");
  }

  const product = await database.product.findFirst({
    select: { id: true, slug: true },
    where: { id: parsed.data.productId, status: "PUBLISHED" }
  });
  if (!product) {
    throw new Error("La ficha ya no está disponible para cotizar.");
  }

  const cart = await getOrCreateActiveCart(customer.accountId);
  await database.commerceCartItem.upsert({
    create: {
      cartId: cart.id,
      productId: product.id,
      quantity: parsed.data.quantity
    },
    update: { quantity: { increment: parsed.data.quantity } },
    where: { cartId_productId: { cartId: cart.id, productId: product.id } }
  });

  revalidatePath("/suministro/carrito");
  revalidatePath(`/suministro/catalogo/${product.slug}`);
  redirect(`/suministro/carrito?added=${encodeURIComponent(product.slug)}`);
}

export async function updateCartItem(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = cartItemIdInput.safeParse({
    cartItemId: formData.get("cartItemId"),
    quantity: formData.get("quantity")
  });
  if (!parsed.success) {
    throw new Error("La cantidad no es válida.");
  }

  await database.commerceCartItem.updateMany({
    data: { quantity: parsed.data.quantity },
    where: {
      cart: { accountId: customer.accountId, status: "ACTIVE" },
      id: parsed.data.cartItemId
    }
  });
  revalidatePath("/suministro/carrito");
}

export async function removeCartItem(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = removeCartItemInput.safeParse({
    cartItemId: formData.get("cartItemId")
  });
  if (!parsed.success) {
    throw new Error("No fue posible retirar este producto.");
  }

  await database.commerceCartItem.deleteMany({
    where: {
      cart: { accountId: customer.accountId, status: "ACTIVE" },
      id: parsed.data.cartItemId
    }
  });
  revalidatePath("/suministro/carrito");
}

export async function requestCartQuote(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = quoteInput.safeParse({
    customerNotes: formData.get("customerNotes") ?? ""
  });
  if (!parsed.success) {
    throw new Error("Revisa la nota para tu solicitud.");
  }

  const cart = await database.commerceCart.findFirst({
    include: { items: { select: { id: true } } },
    orderBy: { updatedAt: "desc" },
    where: { accountId: customer.accountId, status: "ACTIVE" }
  });
  if (!cart?.items.length) {
    redirect("/suministro/carrito?error=empty");
  }

  const reference = quoteReference();
  await database.commerceCart.update({
    data: {
      customerNotes: parsed.data.customerNotes || null,
      reference,
      requestedAt: new Date(),
      requestedById: customer.id,
      status: "QUOTE_REQUESTED"
    },
    where: { id: cart.id }
  });

  revalidatePath("/suministro/carrito");
  revalidatePath("/admin/solicitudes");
  redirect(`/suministro/carrito?requested=${encodeURIComponent(reference)}`);
}
