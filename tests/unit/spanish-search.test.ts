import { describe, expect, it } from "vitest";

import { getSpanishSearchVariants } from "@/lib/commerce/spanish-search";

describe("Spanish catalog search variants", () => {
  it("matches singular, plural and accentless camera queries", () => {
    expect(getSpanishSearchVariants("cámaras")).toEqual(
      expect.arrayContaining(["CÁMARAS", "CAMARAS", "CÁMARA", "CAMARA"])
    );
  });

  it("keeps product identifiers literal while allowing a compact search form", () => {
    expect(getSpanishSearchVariants("AC-935753")).toEqual(
      expect.arrayContaining(["AC-935753", "AC935753"])
    );
  });
});
