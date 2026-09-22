import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMercadoPagoOrder,
  verifyMercadoPagoWebhookSignature
} from "@/lib/commerce/mercado-pago";
import {
  calculateSnapshotTotal,
  calculateSpeiTotals,
  mapMercadoPagoOrderStatus
} from "@/lib/commerce/payment-core";
import { validateSpeiProof } from "@/lib/commerce/spei-documents";
import { createSpeiQuotePdf } from "@/lib/commerce/spei-quote-pdf";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("commerce payment money", () => {
  it("calculates SPEI from immutable order snapshots with cents precision", () => {
    const subtotal = calculateSnapshotTotal([
      { quantity: 2, snapshotUnitPriceWithTax: 1299.95 },
      { quantity: 3, snapshotUnitPriceWithTax: 100 }
    ]);
    expect(subtotal).toBe(2899.9);
    expect(calculateSpeiTotals(subtotal, 3)).toEqual({
      discountAmount: 87,
      subtotal: 2899.9,
      total: 2812.9,
      totalBeforeDiscount: 2899.9
    });
  });

  it("rejects an order that has an unresolved snapshot price", () => {
    expect(() =>
      calculateSnapshotTotal([{ quantity: 1, snapshotUnitPriceWithTax: null }])
    ).toThrow("requiere validar");
  });

  it("maps only provider-side statuses", () => {
    expect(mapMercadoPagoOrderStatus("processed")).toBe("APPROVED");
    expect(mapMercadoPagoOrderStatus("failed")).toBe("REJECTED");
    expect(mapMercadoPagoOrderStatus("canceled")).toBe("CANCELLED");
    expect(mapMercadoPagoOrderStatus("expired")).toBe("EXPIRED");
    expect(mapMercadoPagoOrderStatus("processed", "refunded")).toBe("REFUNDED");
    expect(mapMercadoPagoOrderStatus("processed", "partially_refunded")).toBe(
      "PARTIALLY_REFUNDED"
    );
    expect(mapMercadoPagoOrderStatus("unknown")).toBe("PENDING");
  });
});

describe("Mercado Pago webhook signature", () => {
  it("accepts the official id/request-id/timestamp HMAC manifest and rejects tampering", () => {
    const dataId = "ORD01ABC";
    const requestId = "request-123";
    const timestamp = "1742505638683";
    const secret = "webhook-secret-for-test";
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
    const hash = createHmac("sha256", secret).update(manifest).digest("hex");
    expect(
      verifyMercadoPagoWebhookSignature({
        dataId,
        secret,
        xRequestId: requestId,
        xSignature: `ts=${timestamp},v1=${hash}`
      })
    ).toBe(true);
    expect(
      verifyMercadoPagoWebhookSignature({
        dataId: "ORD01OTHER",
        secret,
        xRequestId: requestId,
        xSignature: `ts=${timestamp},v1=${hash}`
      })
    ).toBe(false);
  });
});

describe("Mercado Pago Orders payload", () => {
  it("sends only item properties accepted by the current Orders API", async () => {
    vi.stubEnv("MP_CREDENTIALS_ENVIRONMENT", "sandbox");
    vi.stubEnv("MP_SANDBOX_ACCESS_TOKEN", "sandbox-access-token");
    vi.stubEnv("MP_PRODUCTION_ACCESS_TOKEN", "");
    vi.stubEnv("MP_PRODUCTION_PUBLIC_KEY", "");
    vi.stubEnv("MP_PRODUCTION_WEBHOOK_SECRET", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          external_reference: "PAY-QA-001",
          id: "order-qa-001",
          status: "processed",
          total_amount: "25.00",
          transactions: { payments: [] }
        }),
        { headers: { "Content-Type": "application/json" }, status: 201 }
      )
    );

    await createMercadoPagoOrder({
      amount: 25,
      customerEmail: "test@testuser.com",
      description: "Pedido QA",
      externalReference: "PAY-QA-001",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      installments: 1,
      items: [
        {
          description: "Producto QA",
          name: "Producto QA",
          quantity: 1,
          sku: "QA-001",
          unitPriceWithTax: 25
        }
      ],
      payerIdentification: null,
      paymentMethodId: "visa",
      paymentMethodType: "credit_card",
      token: "card-token-for-contract-test"
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as {
      items: Array<Record<string, unknown>>;
    };
    expect(body.items[0]).toMatchObject({
      external_code: "QA-001",
      quantity: 1,
      title: "Producto QA",
      unit_price: "25.00"
    });
    expect(body.items[0]).not.toHaveProperty("total_amount");
    expect(body.items[0]).not.toHaveProperty("unit_measure");
  });
});

describe("SPEI evidence and final document", () => {
  it("requires declared MIME, extension, and file magic to agree", () => {
    const pdf = new Uint8Array(Buffer.from("%PDF-1.7\nproof", "ascii"));
    expect(
      validateSpeiProof({
        bytes: pdf,
        declaredMimeType: "application/pdf",
        originalFileName: "transferencia.pdf"
      }).mimeType
    ).toBe("application/pdf");
    expect(() =>
      validateSpeiProof({
        bytes: pdf,
        declaredMimeType: "image/png",
        originalFileName: "transferencia.png"
      })
    ).toThrow("MIME");
  });

  it("creates a standalone final PDF from the stored quote snapshot", async () => {
    const pdf = await createSpeiQuotePdf({
      bankAccount: {
        accountNumber: "1234567890",
        accountType: "CUENTA",
        alias: "PRINCIPAL",
        bankName: "BANCO QA",
        beneficiary: "JANVIER QA",
        clabe: "123456789012345678",
        currency: "MXN"
      },
      customerCompanyName: "CLIENTE QA",
      customerContactName: "CONTACTO QA",
      customerEmail: "qa@example.test",
      discountAmount: 30,
      discountPercentage: 3,
      expiresAt: new Date("2026-09-20T12:00:00.000Z"),
      issuedAt: new Date("2026-09-19T12:00:00.000Z"),
      items: [
        {
          brand: "JANVIER",
          lineTotal: 1000,
          name: "PRODUCTO DE PRUEBA",
          quantity: 1,
          sku: "QA-001",
          unitPrice: 1000
        }
      ],
      reference: "SPEI-20260919-QA",
      sellerContact: "ventas@example.test",
      sellerName: "JANVIER",
      sellerTerms: "Vigencia de 24 horas.",
      subtotal: 1000,
      total: 970,
      totalBeforeDiscount: 1000
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
