import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cartFindFirst: vi.fn(),
  customerEmailDeliveryIsConfigured: vi.fn(),
  orderCreate: vi.fn(),
  orderFindFirst: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireCurrentCustomer: vi.fn(),
  transaction: vi.fn(),
  transactionLock: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth/current-customer", () => ({
  requireCurrentCustomer: mocks.requireCurrentCustomer
}));
vi.mock("@/lib/customer-accounts/enrollment", () => ({
  customerEmailDeliveryIsConfigured: mocks.customerEmailDeliveryIsConfigured,
  sendCustomerCommerceEmail: vi.fn()
}));
vi.mock("@/lib/database", () => ({
  database: { $transaction: mocks.transaction }
}));

import { requestOrderFromQuote } from "@/app/suministro/commerce-actions";

const quoteId = "ck12345678901234567890123";
const productId = "ckabcdefghijklmno12345678";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.customerEmailDeliveryIsConfigured.mockReturnValue(false);
  mocks.requireCurrentCustomer.mockResolvedValue({
    account: { commercialDiscountPct: 7.5, companyName: "Empresa de prueba" },
    accountId: "account-1",
    email: "cliente@example.com",
    id: "user-1"
  });
  mocks.orderFindFirst.mockResolvedValue(null);
  mocks.cartFindFirst.mockResolvedValue({
    customerNotes: "Entregar en obra.",
    id: quoteId,
    items: [
      {
        product: {
          basePriceWithTax: 116,
          brand: "Marca",
          name: "Producto",
          sku: "SKU-1",
          stockTotal: 8
        },
        productId,
        quantity: 2,
        snapshotAt: new Date("2026-09-19T00:00:00.000Z"),
        snapshotBrand: "Marca",
        snapshotDiscountPct: 7.5,
        snapshotName: "Producto",
        snapshotSku: "SKU-1",
        snapshotStockTotal: 8,
        snapshotUnitPriceWithTax: 107.3
      }
    ]
  });
  mocks.orderCreate.mockResolvedValue({ reference: "PED-20260919-TEST" });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      $executeRaw: mocks.transactionLock,
      commerceCart: { findFirst: mocks.cartFindFirst },
      commerceOrder: {
        create: mocks.orderCreate,
        findFirst: mocks.orderFindFirst
      }
    })
  );
});

describe("requestOrderFromQuote", () => {
  it("creates one account-owned, non-payable order with quote snapshots", async () => {
    const formData = new FormData();
    formData.set("quoteCartId", quoteId);

    await requestOrderFromQuote(formData);

    expect(mocks.orderFindFirst).toHaveBeenCalledWith({
      select: { reference: true },
      where: { accountId: "account-1", sourceQuoteId: quoteId }
    });
    expect(mocks.cartFindFirst).toHaveBeenCalledWith({
      include: {
        items: {
          include: {
            product: {
              select: {
                basePriceWithTax: true,
                brand: true,
                name: true,
                sku: true,
                stockTotal: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      where: { accountId: "account-1", id: quoteId, status: "QUOTE_REQUESTED" }
    });
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-1",
          customerNotes: "Entregar en obra.",
          requestedById: "user-1",
          sourceQuoteId: quoteId
        }),
        select: { reference: true }
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pedidos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/suministro/mi-cuenta");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/suministro/carrito?orderRequested=PED-20260919-TEST"
    );
  });
});
