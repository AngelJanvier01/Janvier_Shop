import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  imageUpdateMany: vi.fn(),
  productUpdate: vi.fn(),
  requireCurrentAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/current-admin", () => ({
  requireCurrentAdmin: mocks.requireCurrentAdmin
}));
vi.mock("@/lib/database", () => ({
  database: { $transaction: mocks.transaction }
}));

import { publishCatalogProduct } from "@/app/(admin)/admin/catalogo/actions";

const productId = "ck12345678901234567890123";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCurrentAdmin.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  mocks.productUpdate.mockResolvedValue({ slug: "producto-de-prueba" });
  mocks.imageUpdateMany.mockResolvedValue({ count: 3 });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      product: { update: mocks.productUpdate },
      productImageDerivative: { updateMany: mocks.imageUpdateMany }
    })
  );
});

describe("catalog publishing shortcut", () => {
  it("publishes the product and approves every ready processed image atomically", async () => {
    const formData = new FormData();
    formData.set("productId", productId);

    await publishCatalogProduct(formData);

    expect(mocks.productUpdate).toHaveBeenCalledWith({
      data: { status: "PUBLISHED" },
      select: { slug: true },
      where: { id: productId }
    });
    expect(mocks.imageUpdateMany).toHaveBeenCalledWith({
      data: {
        reviewedAt: expect.any(Date),
        reviewedById: "admin-1",
        status: "APPROVED"
      },
      where: {
        productId,
        status: "READY",
        storageKey: { not: null }
      }
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/catalogo");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/suministro/catalogo/producto-de-prueba"
    );
  });

  it("keeps editors from using the publishing shortcut", async () => {
    mocks.requireCurrentAdmin.mockResolvedValue({ id: "editor-1", role: "EDITOR" });
    const formData = new FormData();
    formData.set("productId", productId);

    await expect(publishCatalogProduct(formData)).rejects.toThrow(
      "Tu perfil no puede publicar productos."
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
