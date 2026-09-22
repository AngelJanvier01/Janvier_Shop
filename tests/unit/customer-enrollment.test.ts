import { describe, expect, it } from "vitest";

import { customerEnrollmentInput } from "@/lib/customer-accounts/enrollment";

const baseEnrollment = {
  companyName: "",
  contactName: "Cliente de prueba",
  contactPhone: "4921234567",
  contactRole: "",
  email: "cliente@example.com",
  isBusiness: false,
  purchaseIntent: "",
  purchaseVolume: "PERSONAL" as const,
  taxId: "",
  termsAccepted: true as const
};

describe("customer enrollment invoice preference", () => {
  it("accepts a personal account that does not need a CFDI", () => {
    const result = customerEnrollmentInput.safeParse({
      ...baseEnrollment,
      requiresInvoice: false
    });

    expect(result.success).toBe(true);
  });

  it("requires an RFC when a personal account requests a CFDI", () => {
    const result = customerEnrollmentInput.safeParse({
      ...baseEnrollment,
      requiresInvoice: true
    });

    expect(result.success).toBe(false);
  });

  it("accepts a personal CFDI request with a valid RFC", () => {
    const result = customerEnrollmentInput.safeParse({
      ...baseEnrollment,
      requiresInvoice: true,
      taxId: "XAXX010101000"
    });

    expect(result.success).toBe(true);
  });
});
