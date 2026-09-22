import { describe, expect, it } from "vitest";

import { summarizeTerminalImageFailures } from "@/lib/product-images/failure-notifications";

describe("product image terminal failure notifications", () => {
  it("groups failed images by SKU and reports attempts and causes", () => {
    const summary = summarizeTerminalImageFailures([
      {
        attempts: 5,
        lastErrorCode: "SOURCE_FETCH_FAILED",
        product: { name: "Producto A", sku: "SKU-A" }
      },
      {
        attempts: 5,
        lastErrorCode: "IMAGE_PROCESSING_FAILED",
        product: { name: "Producto A", sku: "SKU-A" }
      },
      {
        attempts: 5,
        lastErrorCode: null,
        product: { name: "Producto B", sku: "SKU-B" }
      }
    ]);

    expect(summary.keys).toEqual(["SKU-A", "SKU-B"]);
    expect(summary.details[0]).toEqual({
      label: "SKU-A",
      value:
        "Producto A · 2 imagen(es) · 5 intentos · IMAGE_PROCESSING_FAILED, SOURCE_FETCH_FAILED"
    });
    expect(summary.details[1]?.value).toContain("IMAGE_PROCESSING_FAILED");
  });
});
