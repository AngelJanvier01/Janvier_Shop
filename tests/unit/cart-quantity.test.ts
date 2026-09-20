import { describe, expect, it } from "vitest";

import { getCartQuantity } from "../../lib/commerce/cart-quantity";

describe("getCartQuantity", () => {
  it("sums pieces instead of cart lines", () => {
    expect(getCartQuantity([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
  });

  it("treats an empty cart as zero pieces", () => {
    expect(getCartQuantity(undefined)).toBe(0);
  });
});
