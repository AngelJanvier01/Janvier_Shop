import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  customerEmailDeliveryIsConfigured: vi.fn(),
  findUnique: vi.fn(),
  revalidatePath: vi.fn(),
  requireCurrentAdmin: vi.fn(),
  sendCustomerCommerceEmail: vi.fn(),
  update: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth/current-admin", () => ({
  requireCurrentAdmin: mocks.requireCurrentAdmin
}));
vi.mock("@/lib/customer-accounts/enrollment", () => ({
  customerEmailDeliveryIsConfigured: mocks.customerEmailDeliveryIsConfigured,
  sendCustomerCommerceEmail: mocks.sendCustomerCommerceEmail
}));
vi.mock("@/lib/database", () => ({
  database: {
    commerceOrder: {
      findUnique: mocks.findUnique,
      update: mocks.update
    }
  }
}));

import { reviewCommerceOrder } from "@/app/(admin)/admin/pedidos/actions";

const orderId = "ck12345678901234567890123";

function updateForm(status: string) {
  const formData = new FormData();
  formData.set("adminNotes", "Existencia confirmada para entrega.");
  formData.set("orderId", orderId);
  formData.set("status", status);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  mocks.findUnique.mockResolvedValue({ status: "REQUESTED" });
  mocks.update.mockResolvedValue({
    account: {
      companyName: "Empresa de prueba",
      users: [{ email: "owner@example.com" }]
    },
    reference: "PED-20260919-TEST",
    status: "CONFIRMED"
  });
  mocks.customerEmailDeliveryIsConfigured.mockReturnValue(true);
  mocks.sendCustomerCommerceEmail.mockResolvedValue({ error: null });
  mocks.after.mockImplementation(async (callback: () => Promise<void>) => callback());
});

describe("reviewCommerceOrder", () => {
  it("updates the operational status, invalidates the customer views, and notifies its owner", async () => {
    await reviewCommerceOrder(updateForm("CONFIRMED"));

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminNotes: "Existencia confirmada para entrega.",
          reviewedById: "admin-1",
          status: "CONFIRMED"
        }),
        where: { id: orderId }
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pedidos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/suministro/mi-cuenta");
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.sendCustomerCommerceEmail).toHaveBeenCalledWith({
      companyName: "Empresa de prueba",
      email: "owner@example.com",
      reference: "PED-20260919-TEST",
      status: "CONFIRMED",
      type: "ORDER_STATUS"
    });
  });

  it("does not send a duplicate notice when only internal notes change", async () => {
    mocks.findUnique.mockResolvedValue({ status: "CONFIRMED" });

    await reviewCommerceOrder(updateForm("CONFIRMED"));

    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.sendCustomerCommerceEmail).not.toHaveBeenCalled();
  });

  it("keeps catalog editors from changing commercial orders", async () => {
    mocks.requireCurrentAdmin.mockResolvedValue({ id: "editor-1", role: "EDITOR" });

    await expect(reviewCommerceOrder(updateForm("CONFIRMED"))).rejects.toThrow(
      "No tienes permiso para modificar pedidos comerciales."
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
