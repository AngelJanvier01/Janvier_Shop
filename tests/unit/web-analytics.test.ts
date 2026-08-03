import { describe, expect, it } from "vitest";

import {
  hashAnalyticsSession,
  normalizeReferrerOrigin,
  webAnalyticsEventSchema
} from "../../lib/analytics/events";

const validEvent = {
  eventType: "CTA_CLICK" as const,
  path: "/diagnostico",
  referrerOrigin: "https://www.google.com/search?q=janvier",
  sessionId: "a".repeat(32),
  target: "HOME_DIAGNOSTIC",
  theme: "night" as const,
  viewport: "desktop" as const
};

describe("first-party web analytics", () => {
  it("accepts an anonymous public event and keeps only an origin", () => {
    expect(webAnalyticsEventSchema.parse(validEvent)).toMatchObject(validEvent);
    expect(normalizeReferrerOrigin(validEvent.referrerOrigin)).toBe(
      "https://www.google.com"
    );
  });

  it("rejects private routes, query-shaped paths and unbounded labels", () => {
    expect(
      webAnalyticsEventSchema.safeParse({ ...validEvent, path: "/admin" }).success
    ).toBe(false);
    expect(
      webAnalyticsEventSchema.safeParse({ ...validEvent, path: "/?email=x" }).success
    ).toBe(false);
    expect(
      webAnalyticsEventSchema.safeParse({ ...validEvent, target: "a value with spaces" })
        .success
    ).toBe(false);
  });

  it("hashes the ephemeral session before persistence", () => {
    const hash = hashAnalyticsSession(validEvent.sessionId);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(validEvent.sessionId);
    expect(hash).toBe(hashAnalyticsSession(validEvent.sessionId));
  });
});
