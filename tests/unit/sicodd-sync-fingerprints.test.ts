import { describe, expect, it } from "vitest";

import { productImageSourceHash } from "@/lib/product-images/queue";
import {
  sicoddContentHash,
  uniqueSupplierImageUrls,
  withoutExcludedSupplierImages
} from "@/lib/sicodd/sync-fingerprints";

describe("SICODD incremental fingerprints", () => {
  it("keeps equivalent object payloads stable even when supplier fields arrive reordered", () => {
    const first = {
      details: { warranty: 2, upc: "750" },
      specifications: [{ label: "COLOR", value: "NEGRO" }]
    };
    const second = {
      specifications: [{ value: "NEGRO", label: "COLOR" }],
      details: { upc: "750", warranty: 2 }
    };

    expect(sicoddContentHash(first)).toBe(sicoddContentHash(second));
  });

  it("deduplicates supplier URLs and permanently filters an excluded source", () => {
    const urls = [
      "https://janvier01.sicodd.com.mx/a.jpg",
      "https://janvier01.sicodd.com.mx/a.jpg",
      "https://janvier01.sicodd.com.mx/b.jpg"
    ];
    const excluded = new Set([productImageSourceHash(urls[0])]);

    expect(uniqueSupplierImageUrls(urls)).toEqual([urls[0], urls[2]]);
    expect(withoutExcludedSupplierImages(urls, excluded)).toEqual([urls[2]]);
  });
});
