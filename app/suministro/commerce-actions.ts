"use server";

import { randomBytes } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCurrentCustomer } from "@/lib/auth/current-customer";
import { getAccountPriceWithTax } from "@/lib/commerce/catalog";
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

const restoreQuoteInput = z.object({
  quoteCartId: z.string().cuid()
});

function quoteReference() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `COT-${day}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

async function lockCustomerCart(
  transaction: Prisma.TransactionClient,
  accountId: string
) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountId}, 0))`;
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

  await database.$transaction(async (transaction) => {
    await lockCustomerCart(transaction, customer.accountId);
    const cart =
      (await transaction.commerceCart.findFirst({
        where: { accountId: customer.accountId, status: "ACTIVE" }
      })) ??
      (await transaction.commerceCart.create({
        data: { accountId: customer.accountId }
      }));
    const existing = await transaction.commerceCartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: product.id } }
    });
    const quantity = (existing?.quantity ?? 0) + parsed.data.quantity;
    if (quantity > 999) {
      throw new Error("La cantidad acumulada no puede superar 999 piezas.");
    }
    await transaction.commerceCartItem.upsert({
      create: { cartId: cart.id, productId: product.id, quantity },
      update: { quantity },
      where: { cartId_productId: { cartId: cart.id, productId: product.id } }
    });
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

  await database.$transaction(async (transaction) => {
    await lockCustomerCart(transaction, customer.accountId);
    await transaction.commerceCartItem.updateMany({
      data: { quantity: parsed.data.quantity },
      where: {
        cart: { accountId: customer.accountId, status: "ACTIVE" },
        id: parsed.data.cartItemId
      }
    });
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

  await database.$transaction(async (transaction) => {
    await lockCustomerCart(transaction, customer.accountId);
    await transaction.commerceCartItem.deleteMany({
      where: {
        cart: { accountId: customer.accountId, status: "ACTIVE" },
        id: parsed.data.cartItemId
      }
    });
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

  const reference = await database.$transaction(async (transaction) => {
    await lockCustomerCart(transaction, customer.accountId);
    const cart = await transaction.commerceCart.findFirst({
      include: { items: { include: { product: true } } },
      where: { accountId: customer.accountId, status: "ACTIVE" }
    });
    if (!cart?.items.length) return null;

    const snapshotAt = new Date();
    for (const item of cart.items) {
      await transaction.commerceCartItem.update({
        data: {
          snapshotAt,
          snapshotBrand: item.product.brand,
          snapshotDiscountPct: customer.account.commercialDiscountPct,
          snapshotName: item.product.name,
          snapshotSku: item.product.sku,
          snapshotStockTotal: item.product.stockTotal,
          snapshotUnitPriceWithTax: getAccountPriceWithTax(
            item.product.basePriceWithTax,
            customer.account.commercialDiscountPct
          )
        },
        where: { id: item.id }
      });
    }

    const nextReference = quoteReference();
    const submitted = await transaction.commerceCart.updateMany({
      data: {
        customerNotes: parsed.data.customerNotes || null,
        reference: nextReference,
        requestedAt: snapshotAt,
        requestedById: customer.id,
        status: "QUOTE_REQUESTED"
      },
      where: { id: cart.id, status: "ACTIVE" }
    });
    return submitted.count ? nextReference : null;
  });
  if (!reference) redirect("/suministro/carrito?error=empty");

  revalidatePath("/suministro/carrito");
  revalidatePath("/admin/solicitudes");
  redirect(`/suministro/carrito?requested=${encodeURIComponent(reference)}`);
}

export async function restoreQuoteToCart(formData: FormData) {
  const customer = await requireCurrentCustomer();
  const parsed = restoreQuoteInput.safeParse({
    quoteCartId: formData.get("quoteCartId")
  });
  if (!parsed.success) {
    throw new Error("No fue posible identificar la cotización que quieres recuperar.");
  }

  const restored = await database.$transaction(async (transaction) => {
    await lockCustomerCart(transaction, customer.accountId);
    const quote = await transaction.commerceCart.findFirst({
      include: {
        items: {
          include: { product: { select: { id: true, status: true } } },
          orderBy: { createdAt: "asc" }
        }
      },
      where: {
        accountId: customer.accountId,
        id: parsed.data.quoteCartId,
        status: "QUOTE_REQUESTED"
      }
    });
    if (!quote?.items.length) {
      throw new Error(
        "Esta cotización ya no tiene productos disponibles para recuperar."
      );
    }

    const itemsToRestore = quote.items.filter(
      (item) => item.product.status === "PUBLISHED"
    );
    if (!itemsToRestore.length) {
      throw new Error(
        "Los productos de esta cotización ya no están disponibles en catálogo."
      );
    }

    const activeCart =
      (await transaction.commerceCart.findFirst({
        include: { items: { select: { productId: true, quantity: true } } },
        where: { accountId: customer.accountId, status: "ACTIVE" }
      })) ??
      (await transaction.commerceCart.create({
        data: { accountId: customer.accountId },
        include: { items: { select: { productId: true, quantity: true } } }
      }));
    const activeQuantities = new Map(
      activeCart.items.map((item) => [item.productId, item.quantity])
    );
    const requestedQuantities = new Map<string, number>();
    for (const item of itemsToRestore) {
      requestedQuantities.set(
        item.productId,
        (requestedQuantities.get(item.productId) ?? 0) + item.quantity
      );
    }
    for (const [productId, quantity] of requestedQuantities) {
      if ((activeQuantities.get(productId) ?? 0) + quantity > 999) {
        throw new Error(
          "Una partida superaría 999 piezas. Ajusta primero la cantidad de tu lista activa."
        );
      }
    }

    for (const [productId, quantity] of requestedQuantities) {
      await transaction.commerceCartItem.upsert({
        create: { cartId: activeCart.id, productId, quantity },
        update: { quantity: { increment: quantity } },
        where: { cartId_productId: { cartId: activeCart.id, productId } }
      });
    }
    return quote.reference ?? quote.id;
  });

  revalidatePath("/suministro/carrito");
  redirect(`/suministro/carrito?restored=${encodeURIComponent(restored)}`);
}
