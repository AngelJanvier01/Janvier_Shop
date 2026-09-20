import { afterEach, describe, expect, it, vi } from "vitest";

import { requestClientIdentity, requestRateKey } from "@/lib/security/request-guard";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("request guard identity", () => {
  it("does not trust a browser-supplied forwarding header by default", () => {
    vi.stubEnv("TRUST_PROXY_CLIENT_IP", "false");
    const headers = new Headers({ "x-forwarded-for": "203.0.113.99" });

    expect(requestClientIdentity(headers)).toBe("proxy-untrusted");
  });

  it("uses only a valid proxy identity after explicit deployment opt-in", () => {
    vi.stubEnv("TRUST_PROXY_CLIENT_IP", "true");
    const headers = new Headers({
      "cf-connecting-ip": "2001:db8::7",
      "x-forwarded-for": "203.0.113.99, 10.0.0.1"
    });

    expect(requestClientIdentity(headers)).toBe("2001:db8::7");
  });

  it("persists a one-way key rather than the actor or IP address", () => {
    vi.stubEnv("TRUST_PROXY_CLIENT_IP", "true");
    const key = requestRateKey(
      "customer-login",
      "customer@example.com",
      new Headers({ "x-forwarded-for": "203.0.113.99" })
    );

    expect(key).toMatch(/^[a-f0-9]{64}$/u);
    expect(key).not.toContain("customer@example.com");
    expect(key).not.toContain("203.0.113.99");
  });
});
