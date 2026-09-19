import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cartFindFirst: vi.fn(),
  cartItemUpsert: vi.fn(),
  cartCreate: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  requireCurrentCustomer: vi.fn(),
  transaction: vi.fn(),
  transactionLock: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/current-customer", () => ({
  requireCurrentCustomer: mocks.requireCurrentCustomer
}));
vi.mock("@/lib/database", () => ({
  database: { $transaction: mocks.transaction }
}));

import { restoreQuoteToCart } from "@/app/suministro/commerce-actions";

const cartId = "ck12345678901234567890123";
const productId = "ckabcdefghijklmno12345678";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCurrentCustomer.mockResolvedValue({
    accountId: "account-1",
    id: "user-1"
  });
  mocks.cartFindFirst
    .mockResolvedValueOnce({
      id: cartId,
      items: [
        {
          product: { id: productId, status: "PUBLISHED" },
          productId,
          quantity: 2
        }
      ],
      reference: "COT-20260919-TEST"
    })
    .mockResolvedValueOnce({
      id: "active-cart",
      items: [{ productId, quantity: 1 }]
    });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      $executeRaw: mocks.transactionLock,
      commerceCart: {
        create: mocks.cartCreate,
        findFirst: mocks.cartFindFirst
      },
      commerceCartItem: { upsert: mocks.cartItemUpsert }
    })
  );
});

describe("restoreQuoteToCart", () => {
  it("copies only the account-owned quote into the active cart while retaining history", async () => {
    const formData = new FormData();
    formData.set("quoteCartId", cartId);

    await restoreQuoteToCart(formData);

    expect(mocks.cartFindFirst).toHaveBeenNthCalledWith(1, {
      include: {
        items: {
          include: { product: { select: { id: true, status: true } } },
          orderBy: { createdAt: "asc" }
        }
      },
      where: {
        accountId: "account-1",
        id: cartId,
        status: "QUOTE_REQUESTED"
      }
    });
    expect(mocks.cartItemUpsert).toHaveBeenCalledWith({
      create: { cartId: "active-cart", productId, quantity: 2 },
      update: { quantity: { increment: 2 } },
      where: { cartId_productId: { cartId: "active-cart", productId } }
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/suministro/carrito");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/suministro/carrito?restored=COT-20260919-TEST"
    );
  });
});
