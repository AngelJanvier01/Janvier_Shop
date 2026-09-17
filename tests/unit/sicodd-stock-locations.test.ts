import { describe, expect, it } from "vitest";

import {
  configuredPublicWarehouses,
  filterSicoddStockLocations
} from "@/lib/sicodd/stock-locations";

const locations = [
  { location: "Bodega México", quantity: 8 },
  { location: "Bodega externa", quantity: 40 }
];

describe("SICODD stock visibility", () => {
  it("hides every supplier warehouse when no public allowlist exists", () => {
    expect(filterSicoddStockLocations(locations, false, new Set())).toEqual([]);
  });

  it("keeps only allowlisted warehouses with accent-insensitive matching", () => {
    const allowlist = configuredPublicWarehouses(" bodega mexico ");
    expect(filterSicoddStockLocations(locations, false, allowlist)).toEqual([
      locations[0]
    ]);
  });

  it("keeps every location only when the setting explicitly allows it", () => {
    expect(filterSicoddStockLocations(locations, true, new Set())).toEqual(locations);
  });
});
