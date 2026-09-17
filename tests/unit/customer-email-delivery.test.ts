import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendCustomerLifecycleEmail,
  sendCustomerVerificationEmail
} from "@/lib/customer-accounts/enrollment";

const originalUrl = process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL;
const originalSecret = process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_SECRET;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL = originalUrl;
  process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_SECRET = originalSecret;
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("customer email delivery", () => {
  it("retries a temporary webhook failure", async () => {
    process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL = "https://mail.example.test/send";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendCustomerVerificationEmail({
        email: "client@example.com",
        verificationId: "verification-1",
        verificationUrl: "https://example.com/verify"
      })
    ).resolves.toEqual({ error: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends an approval template with the account URL", async () => {
    process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL = "https://mail.example.test/send";
    process.env.NEXT_PUBLIC_SITE_URL = "https://janvier.example";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendCustomerLifecycleEmail({
      companyName: "Cliente QA",
      decision: "APPROVED",
      email: "client@example.com"
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      accountUrl: "https://janvier.example/suministro/acceso",
      template: "customer-account-approved",
      to: "client@example.com"
    });
  });
});
