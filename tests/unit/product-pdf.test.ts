import { describe, expect, it } from "vitest";

import { createProductInformationPdf } from "@/lib/commerce/product-pdf";

const product = {
  brand: "JANVIER LAB",
  category: "REDES",
  description: "Equipo de prueba para verificar la ficha técnica descargable.",
  name: "SWITCH ADMINISTRABLE DE PRUEBA",
  partNumber: "JV-SW-24",
  productUrl: "https://janvier.example/suministro/catalogo/switch-prueba",
  siteUrl: "https://janvier.example",
  sku: "TEST-24",
  specialOrder: false,
  specifications: [
    { label: "Puertos", value: "24 Gigabit Ethernet" },
    { label: "Montaje", value: "Rack 19 pulgadas" }
  ],
  stockTotal: 32,
  upc: null,
  warrantyYears: 2
};

describe("product information PDF", () => {
  it("creates a single-page branded PDF for a regular product", async () => {
    const pdf = await createProductInformationPdf(product);
    const source = pdf.toString("latin1");

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2_000);
    expect(source.match(/\/Type \/Page\b/gu)).toHaveLength(1);
  });

  it("paginates long specifications without losing the document", async () => {
    const pdf = await createProductInformationPdf({
      ...product,
      specifications: Array.from({ length: 45 }, (_, index) => ({
        label: `Característica ${index + 1}`,
        value: `Valor técnico ${index + 1} con información suficientemente descriptiva`
      }))
    });
    const pages = pdf.toString("latin1").match(/\/Type \/Page\b/gu)?.length ?? 0;

    expect(pages).toBeGreaterThan(1);
  });
});
