import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isDeliveryQueueReady: vi.fn(),
  queueAdminEmailSafely: vi.fn(),
  queueRecipientEmail: vi.fn()
}));

vi.mock("@/lib/notifications/config", () => ({
  getEmailConfiguration: () => ({
    appUrl: "https://janvier.example",
    isEnabled: true
  })
}));
vi.mock("@/lib/notifications/delivery-provider", () => ({
  isDeliveryQueueReady: mocks.isDeliveryQueueReady
}));
vi.mock("@/lib/notifications/outbox", () => ({
  queueAdminEmailSafely: mocks.queueAdminEmailSafely,
  queueRecipientEmail: mocks.queueRecipientEmail
}));

import {
  sendCustomerLifecycleEmail,
  sendCustomerVerificationEmail
} from "@/lib/customer-accounts/enrollment";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isDeliveryQueueReady.mockResolvedValue(true);
  mocks.queueRecipientEmail.mockResolvedValue({ queued: 1 });
  mocks.queueAdminEmailSafely.mockResolvedValue({ queued: 1 });
});

describe("customer email delivery", () => {
  it("queues the verification through the branded durable outbox", async () => {
    await expect(
      sendCustomerVerificationEmail({
        email: "client@example.com",
        verificationId: "verification-1",
        verificationUrl: "https://janvier.example/verify"
      })
    ).resolves.toEqual({ error: null, queued: 1 });

    expect(mocks.queueRecipientEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "customer-verification:verification-1",
        kind: "CUSTOMER_EMAIL_VERIFICATION",
        recipient: "client@example.com",
        subject: "JANVIER · Confirma tu correo para activar tu solicitud"
      })
    );
  });

  it("notifies the client and the JANVIER team when an account is approved", async () => {
    await sendCustomerLifecycleEmail({
      accountId: "account-1",
      companyName: "Cliente QA",
      decision: "APPROVED",
      email: "client@example.com"
    });

    expect(mocks.queueRecipientEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: "customer-lifecycle:account-1:APPROVED",
        kind: "CUSTOMER_ACCOUNT_APPROVED",
        recipient: "client@example.com"
      })
    );
    expect(mocks.queueAdminEmailSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        actionUrl: "https://janvier.example/admin/clientes",
        kind: "ADMIN_CUSTOMER_ACCOUNT_REQUESTED"
      })
    );
  });
});
