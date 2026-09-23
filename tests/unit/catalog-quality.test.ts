import { describe, expect, it } from "vitest";

import { assessCatalogQuality } from "@/lib/commerce/catalog-quality";

const complete = {
  basePriceWithTax: 150,
  brand: "TIGRE",
  catalogReviewApproved: false,
  category: "TONERS",
  description: "Un cartucho de tóner compatible con una capacidad y rendimiento documentados para oficinas de alto volumen y equipos de impresión de uso continuo.",
  galleryUrls: ["https://example.com/toner.png"],
  imageDerivatives: [{ sourceUrl: "https://example.com/toner.png", status: "APPROVED" }],
  imageUrl: "https://example.com/toner.png",
  name: "TÓNER TIGRE",
  sku: "123456",
  specifications: [{ label: "Rendimiento", value: "1200 páginas" }],
  supplierCostWithTax: 100,
  supplierSourceUrl: "https://example.com/admin/producto/ficha/upc/123456",
  supplierSubcategoryId: "subcategory-1"
};

describe("catalog quality assessment", () => {
  it("does not flag a complete product or a stale derivative", () => {
    const result = assessCatalogQuality({
      ...complete,
      imageDerivatives: [
        ...complete.imageDerivatives,
        { sourceUrl: "https://example.com/old.png", status: "REJECTED" }
      ]
    });
    expect(result.issues).toEqual([]);
    expect(result.needsReview).toBe(false);
  });

  it("labels missing supplier content without inventing specifications", () => {
    const result = assessCatalogQuality({
      ...complete,
      brand: null,
      description: complete.name,
      specifications: null,
      supplierSubcategoryId: null
    });
    expect(result.issues).toEqual(["BRAND", "CATEGORY", "DESCRIPTION", "SPECIFICATIONS"]);
    expect(result.needsReview).toBe(true);
  });

  it("distinguishes processing from an absent or failed image", () => {
    expect(assessCatalogQuality({
      ...complete,
      imageDerivatives: [{ sourceUrl: complete.imageUrl!, status: "PROCESSING" }]
    }).issues).toEqual([]);
    expect(assessCatalogQuality({ ...complete, galleryUrls: [], imageUrl: null, imageDerivatives: [] }).issues).toContain("SOURCE_IMAGE");
    expect(assessCatalogQuality({ ...complete, imageDerivatives: [{ sourceUrl: complete.imageUrl!, status: "DEAD" }] }).issues).toContain("IMAGE_FAILED");
    expect(assessCatalogQuality({
      ...complete,
      galleryUrls: [complete.imageUrl!, "https://example.com/second.png"],
      imageDerivatives: [
        ...complete.imageDerivatives,
        { sourceUrl: "https://example.com/second.png", status: "REJECTED" }
      ]
    }).issues).toContain("IMAGE_FAILED");
  });

  it("keeps accepted exceptions visible without treating them as unattended", () => {
    const result = assessCatalogQuality({ ...complete, brand: null, catalogReviewApproved: true });
    expect(result.issues).toEqual(["BRAND"]);
    expect(result.reviewed).toBe(true);
    expect(result.needsReview).toBe(false);
  });
});
