import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyMercadoPagoWebhookSignature } from "@/lib/commerce/mercado-pago";
import {
  calculateSnapshotTotal,
  calculateSpeiTotals,
  mapMercadoPagoOrderStatus
} from "@/lib/commerce/payment-core";
import { validateSpeiProof } from "@/lib/commerce/spei-documents";
import { createSpeiQuotePdf } from "@/lib/commerce/spei-quote-pdf";

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
