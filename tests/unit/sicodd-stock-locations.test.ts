import { describe, expect, it } from "vitest";

import {
  normalizeSicoddStockLocationName,
  prepareSicoddStockLocations,
  sicoddStockTotal
} from "@/lib/sicodd/stock-locations";

describe("SICODD stock snapshots", () => {
  it("normalizes, deduplicates and clamps supplier inventory safely", () => {
    const prepared = prepareSicoddStockLocations([
      { location: " DICOTECH León ", quantity: 12.9 },
      { location: "dicotech leon", quantity: 3 },
      { location: "Guadalajara", quantity: -4 },
      { location: "Sin dato", quantity: null }
    ]);

    expect(prepared).toEqual([
      { location: "DICOTECH León", quantity: 15 },
      { location: "Guadalajara", quantity: 0 }
    ]);
    expect(sicoddStockTotal(prepared)).toBe(15);
    expect(normalizeSicoddStockLocationName("  León  ")).toBe("LEON");
  });
});
