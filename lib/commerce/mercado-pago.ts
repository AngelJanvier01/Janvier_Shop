import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { mapMercadoPagoOrderStatus, paymentCurrency, sha256 } from "./payment-core";

const mercadoPagoApiBaseUrl = "https://api.mercadopago.com";

const identifierSchema = z
  .object({
    number: z.string().trim().min(3).max(32),
    type: z.string().trim().min(2).max(20)
  })
  .nullable()
  .optional();

export const mercadoPagoCheckoutInputSchema = z.object({
  installments: z.coerce.number().int().min(1).max(36),
  orderReference: z.string().trim().min(8).max(48),
  payerIdentification: identifierSchema,
  paymentMethodId: z.string().trim().min(2).max(80),
  paymentMethodType: z.string().trim().min(2).max(80),
  token: z.string().trim().min(16).max(1024)
});

export type MercadoPagoOrderItem = {
  description: string | null;
  name: string | null;
  quantity: number;
  sku: string | null;
  unitPriceWithTax: number;
};

export type MercadoPagoOrderPayload = {
  amount: number;
  customerEmail: string;
  description: string;
  externalReference: string;
  idempotencyKey: string;
  items: MercadoPagoOrderItem[];
  payerIdentification?: { number: string; type: string } | null;
  paymentMethodId: string;
  paymentMethodType: string;
  token: string;
  installments: number;
};

export type MercadoPagoOrderResponse = {
  currency?: string | null;
  externalReference?: string | null;
  id: string;
  paymentMethodId?: string | null;
  paymentMethodType?: string | null;
  paymentId?: string | null;
  status: string | null;
  statusDetail: string | null;
  totalAmount: number | null;
};

export class MercadoPagoConfigurationError extends Error {}
export class MercadoPagoRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}

function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token)
    throw new MercadoPagoConfigurationError("MP_ACCESS_TOKEN no está configurado.");
  return token;
}

export function getMercadoPagoPublicConfiguration() {
  const publicKey = process.env.MP_PUBLIC_KEY?.trim() ?? "";
  const accessTokenConfigured = Boolean(process.env.MP_ACCESS_TOKEN?.trim());
  const webhookSecretConfigured = Boolean(process.env.MP_WEBHOOK_SECRET?.trim());
  return {
    accessTokenConfigured,
    publicKey: publicKey || null,
    publicKeyConfigured: Boolean(publicKey),
    ready: Boolean(publicKey && accessTokenConfigured && webhookSecretConfigured),
    webhookSecretConfigured
  };
}

function normalizedAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Number(amount.toFixed(2)) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseProviderOrder(value: unknown): MercadoPagoOrderResponse | null {
  const source = asRecord(value);
  const id = typeof source.id === "string" ? source.id : null;
  if (!id) return null;
  const payments = Array.isArray(asRecord(source.transactions).payments)
    ? (asRecord(source.transactions).payments as unknown[])
    : [];
  const payment = asRecord(payments[0]);
  const method = asRecord(payment.payment_method);
  return {
    currency:
      (typeof source.currency_id === "string" && source.currency_id) ||
      (typeof source.currency === "string" && source.currency) ||
      null,
    externalReference:
      typeof source.external_reference === "string" ? source.external_reference : null,
    id,
    paymentId: typeof payment.id === "string" ? payment.id : null,
    paymentMethodId: typeof method.id === "string" ? method.id : null,
    paymentMethodType: typeof method.type === "string" ? method.type : null,
    status: typeof source.status === "string" ? source.status : null,
    statusDetail:
      (typeof source.status_detail === "string" && source.status_detail) ||
      (typeof payment.status_detail === "string" && payment.status_detail) ||
      null,
    totalAmount: normalizedAmount(source.total_amount)
  };
}

function safeProviderError(value: unknown) {
  const source = asRecord(value);
  const code = typeof source.error === "string" ? source.error : null;
  const message = typeof source.message === "string" ? source.message : null;
  return code ?? message ?? "Mercado Pago no pudo procesar la solicitud.";
}

/** Sends only the Brick token to Mercado Pago. Card PAN/CVV never reach our process or database. */
export async function createMercadoPagoOrder(input: MercadoPagoOrderPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const body = {
    capture_mode: "automatic",
    description: input.description.slice(0, 256),
    external_reference: input.externalReference,
    items: input.items.map((item) => ({
      description: item.description?.slice(0, 256) ?? undefined,
      external_code: item.sku?.slice(0, 80) ?? undefined,
      quantity: item.quantity,
      title: (item.name ?? "PRODUCTO JANVIER").slice(0, 256),
      total_amount: Number((item.unitPriceWithTax * item.quantity).toFixed(2)).toFixed(2),
      unit_measure: "unit",
      unit_price: item.unitPriceWithTax.toFixed(2)
    })),
    payer: {
      email: input.customerEmail,
      ...(input.payerIdentification
        ? {
            identification: {
              number: input.payerIdentification.number,
              type: input.payerIdentification.type
            }
          }
        : {})
    },
    processing_mode: "automatic",
    total_amount: input.amount.toFixed(2),
    transactions: {
      payments: [
        {
          amount: input.amount.toFixed(2),
          payment_method: {
            id: input.paymentMethodId,
            installments: input.installments,
            token: input.token,
            type: input.paymentMethodType
          }
        }
      ]
    },
    type: "online"
  };
  try {
    const response = await fetch(`${mercadoPagoApiBaseUrl}/v1/orders`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey
      },
      method: "POST",
      signal: controller.signal
    });
    const raw = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new MercadoPagoRequestError(
        safeProviderError(raw),
        response.status === 423 || response.status === 429 || response.status >= 500
      );
    }
    const order = parseProviderOrder(raw);
    if (!order) {
      throw new MercadoPagoRequestError(
        "Mercado Pago respondió sin identificador de orden.",
        true
      );
    }
    return order;
  } catch (error) {
    if (
      error instanceof MercadoPagoConfigurationError ||
      error instanceof MercadoPagoRequestError
    ) {
      throw error;
    }
    throw new MercadoPagoRequestError(
      "No fue posible comunicarse con Mercado Pago.",
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMercadoPagoOrder(orderId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `${mercadoPagoApiBaseUrl}/v1/orders/${encodeURIComponent(orderId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken()}` },
        signal: controller.signal
      }
    );
    const raw = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new MercadoPagoRequestError(safeProviderError(raw), response.status >= 500);
    }
    const order = parseProviderOrder(raw);
    if (!order) throw new MercadoPagoRequestError("La orden remota no es válida.", false);
    return order;
  } catch (error) {
    if (
      error instanceof MercadoPagoConfigurationError ||
      error instanceof MercadoPagoRequestError
    ) {
      throw error;
    }
    throw new MercadoPagoRequestError(
      "No fue posible verificar el pago con Mercado Pago.",
      true
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function assertVerifiedMercadoPagoOrder(input: {
  amount: number;
  expectedExternalReference: string;
  order: MercadoPagoOrderResponse;
}) {
  if (input.order.externalReference !== input.expectedExternalReference) {
    throw new MercadoPagoRequestError("La referencia de pago no coincide.", false);
  }
  if (input.order.totalAmount === null || input.order.totalAmount !== input.amount) {
    throw new MercadoPagoRequestError(
      "El importe confirmado no coincide con el pedido.",
      false
    );
  }
  if (input.order.currency && input.order.currency !== paymentCurrency) {
    throw new MercadoPagoRequestError(
      "La moneda confirmada no coincide con el pedido.",
      false
    );
  }
  return mapMercadoPagoOrderStatus(input.order.status, input.order.statusDetail);
}

function signatureParts(value: string | null) {
  const parts = new Map<string, string>();
  for (const part of value?.split(",") ?? []) {
    const [key, ...rest] = part.trim().split("=");
    if (!key || !rest.length) continue;
    parts.set(key, rest.join("=").trim());
  }
  return parts;
}

/** Exact HMAC manifest documented by Mercado Pago for x-signature notifications. */
export function verifyMercadoPagoWebhookSignature(input: {
  dataId: string | null;
  secret: string | null | undefined;
  xRequestId: string | null;
  xSignature: string | null;
}) {
  const secret = input.secret?.trim();
  if (!secret) return false;
  const signature = signatureParts(input.xSignature);
  const timestamp = signature.get("ts");
  const receivedHash = signature.get("v1");
  if (!timestamp || !receivedHash || !/^[a-f0-9]{64}$/iu.test(receivedHash)) return false;
  const pairs = [
    input.dataId ? `id:${input.dataId.toLowerCase()};` : "",
    input.xRequestId ? `request-id:${input.xRequestId};` : "",
    `ts:${timestamp};`
  ];
  const manifest = pairs.join("");
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  return timingSafeEqual(
    Buffer.from(expectedHash, "hex"),
    Buffer.from(receivedHash, "hex")
  );
}

export function mercadoPagoWebhookDeliveryKey(input: {
  action: string | null;
  dataId: string;
  notificationId: string | number | null;
  requestId: string | null;
}) {
  return sha256(
    [
      input.notificationId ?? "",
      input.dataId,
      input.action ?? "",
      input.requestId ?? ""
    ].join("|")
  );
}
