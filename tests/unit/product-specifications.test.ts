import { describe, expect, it } from "vitest";

import {
  extractProductSpecifications,
  specificationsFromLines
} from "@/lib/commerce/product-specifications";

describe("product specifications", () => {
  it("reads legacy manual products", () => {
    expect(extractProductSpecifications({ items: ["16 GB RAM"] })).toEqual([
      { label: "DETALLE", value: "16 GB RAM" }
    ]);
  });

  it("reads normalized supplier specifications", () => {
    expect(
      extractProductSpecifications([{ label: "Memoria", value: "16 GB" }])
    ).toEqual([{ label: "Memoria", value: "16 GB" }]);
  });

  it("normalizes manual lines before persistence", () => {
    expect(specificationsFromLines(["SSD 512 GB"])).toEqual([
      { label: "DETALLE", value: "SSD 512 GB" }
    ]);
  });
});
