import { describe, expect, it } from "vitest";

import { getCatalogCardCopy } from "@/lib/commerce/catalog-card-copy";

describe("getCatalogCardCopy", () => {
  it("turns a repeated product description into the visible continuation", () => {
    expect(
      getCatalogCardCopy(
        "MOUSE INALAMBRICO STYLOS CMOU2, 1200 DPI, 3 BOTONES, SCROLL OPTICO, NEGRO",
        "MOUSE INALAMBRICO STYLOS CMOU2, 1200 DPI, 3 BOTONES, SCROLL OPTICO, NEGRO"
      )
    ).toEqual({
      continuation: "CMOU2, 1200 DPI, 3 BOTONES, SCROLL OPTICO, NEGRO",
      heading: "MOUSE INALAMBRICO STYLOS"
    });
  });

  it("keeps different supplier details after the compact heading", () => {
    expect(
      getCatalogCardCopy(
        "PROCESADOR AMD RYZEN 5 8500G, AM5, 3.50GHZ",
        "Incluye gráficos integrados y garantía de tres años."
      )
    ).toEqual({
      continuation: "AM5, 3.50GHZ Incluye gráficos integrados y garantía de tres años.",
      heading: "PROCESADOR AMD RYZEN 5 8500G"
    });
  });
});
