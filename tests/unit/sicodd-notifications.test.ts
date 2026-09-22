import { describe, expect, it } from "vitest";

import { createSicoddNewProductsPdf } from "@/lib/sicodd/new-products-pdf";

describe("SICODD email reports", () => {
  it("creates a paginated PDF with the keys of every new product", async () => {
    const products = Array.from({ length: 80 }, (_, index) => ({
      name: `Artículo de prueba ${index + 1}`,
      partNumber: `PN-${index + 1}`,
      sku: `SKU-${index + 1}`
    }));
    const pdf = await createSicoddNewProductsPdf({
      finishedAt: new Date("2026-09-22T22:00:00.000Z"),
      products,
      runSequence: 7
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/gu)?.length).toBeGreaterThan(1);
  });
});
