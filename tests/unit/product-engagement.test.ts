import { describe, expect, it } from "vitest";

import {
  hashCustomerEngagementActor,
  hashProductEngagementSession,
  productEngagementEventSchema
} from "@/lib/analytics/product-engagement";

const validEvent = {
  eventType: "GALLERY_COMPLETED" as const,
  galleryImageCount: 4,
  productId: "clx00000000000000000000001",
  sessionId: "b".repeat(32)
};

describe("product engagement measurement", () => {
  it("accepts bounded product events without PII", () => {
    expect(productEngagementEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("rejects unbounded gallery values and unsupported client events", () => {
    expect(
      productEngagementEventSchema.safeParse({ ...validEvent, galleryImageCount: 25 })
        .success
    ).toBe(false);
    expect(
      productEngagementEventSchema.safeParse({ ...validEvent, eventType: "CART_ADDED" })
        .success
    ).toBe(false);
  });

  it("persists one-way HMAC identifiers instead of browser or customer IDs", () => {
    const sessionHash = hashProductEngagementSession(validEvent.sessionId);
    const customerHash = hashCustomerEngagementActor("clx00000000000000000000002");
    expect(sessionHash).toHaveLength(64);
    expect(customerHash).toHaveLength(64);
    expect(sessionHash).not.toContain(validEvent.sessionId);
    expect(customerHash).not.toContain("clx00000000000000000000002");
  });
});
