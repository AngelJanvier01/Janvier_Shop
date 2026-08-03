import { describe, expect, it } from "vitest";

import {
  createDiagnosticWhatsAppUrl,
  diagnosticRequestInputSchema,
  fingerprintDiagnosticRequest
} from "../../lib/diagnostics/request";

describe("diagnostic request input", () => {
  const validInput = {
    budgetRange: "$25,000 a $75,000 MXN",
    companyName: "Operación Norte",
    contactName: "Andrea Rivera",
    email: "ANDREA@EXAMPLE.TEST",
    message: "Necesitamos reducir errores de captura en el equipo operativo.",
    phone: "5550102030",
    service: "Software y automatización",
    timeline: "Este trimestre"
  };

  it("normalizes the public request and produces a human WhatsApp handoff", () => {
    const input = diagnosticRequestInputSchema.parse(validInput);
    const handoff = new URL(createDiagnosticWhatsAppUrl(input));

    expect(input.email).toBe("andrea@example.test");
    expect(handoff.hostname).toBe("wa.me");
    expect(handoff.searchParams.get("text")).toContain("Operación Norte");
    expect(handoff.searchParams.get("text")).toContain("Software y automatización");
  });

  it("rejects malformed, short or honeypot-filled submissions", () => {
    expect(
      diagnosticRequestInputSchema.safeParse({ ...validInput, email: "not-an-email" })
        .success
    ).toBe(false);
    expect(
      diagnosticRequestInputSchema.safeParse({ ...validInput, message: "Muy corto" })
        .success
    ).toBe(false);
    expect(
      diagnosticRequestInputSchema.safeParse({
        ...validInput,
        website: "https://bot.test"
      }).success
    ).toBe(false);
  });

  it("never keeps the source address in the rate-limit fingerprint", () => {
    const fingerprint = fingerprintDiagnosticRequest("203.0.113.15");
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.15");
    expect(fingerprintDiagnosticRequest(null)).toBeNull();
  });
});
