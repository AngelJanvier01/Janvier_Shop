import { NextResponse } from "next/server";

import {
  getMercadoPagoOrder,
  getMercadoPagoWebhookSecret,
  mercadoPagoWebhookDeliveryKey,
  verifyMercadoPagoWebhookSignature
} from "@/lib/commerce/mercado-pago";
import { reconcileMercadoPagoOrder } from "@/lib/commerce/mercado-pago-reconciliation";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookBody = {
  action?: unknown;
  data?: { id?: unknown };
  id?: unknown;
  type?: unknown;
};

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

/**
 * Mercado Pago signs the documented id/request-id/timestamp manifest. We then
 * fetch its order directly; browser callbacks and webhook bodies never decide payment state.
 */
export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => "");
  let body: WebhookBody = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as WebhookBody) : {};
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? stringOrNull(body.data?.id);
  if (!dataId || dataId.length > 160) {
    return NextResponse.json(
      { error: "Recurso de notificación inválido." },
      { status: 400 }
    );
  }
  if (
    !verifyMercadoPagoWebhookSignature({
      dataId,
      secret: getMercadoPagoWebhookSecret(),
      xRequestId: request.headers.get("x-request-id"),
      xSignature: request.headers.get("x-signature")
    })
  ) {
    return NextResponse.json({ error: "Firma no válida." }, { status: 401 });
  }
  const topic = stringOrNull(body.type) ?? url.searchParams.get("type");
  if (topic !== "order" && topic !== "orders") {
    return NextResponse.json({ received: true });
  }
  const action = stringOrNull(body.action);
  const notificationId =
    stringOrNull(body.id) ?? (typeof body.id === "number" ? body.id : null);
  const deliveryKey = mercadoPagoWebhookDeliveryKey({
    action,
    dataId,
    notificationId,
    requestId: request.headers.get("x-request-id")
  });
  let receipt = await database.commercePaymentWebhook.findUnique({
    where: { deliveryKey }
  });
  if (receipt?.processedAt) return NextResponse.json({ received: true });
  if (!receipt) {
    try {
      receipt = await database.commercePaymentWebhook.create({
        data: {
          action,
          deliveryKey,
          provider: "MERCADO_PAGO",
          resourceId: dataId,
          topic,
          verified: true
        }
      });
    } catch (error) {
      if (!uniqueConflict(error)) throw error;
      receipt = await database.commercePaymentWebhook.findUnique({
        where: { deliveryKey }
      });
      if (receipt?.processedAt) return NextResponse.json({ received: true });
    }
  }
  try {
    const order = await getMercadoPagoOrder(dataId);
    const reconciled = await reconcileMercadoPagoOrder({
      order,
      providerEventId: deliveryKey,
      source: "WEBHOOK"
    });
    await database.commercePaymentWebhook.updateMany({
      data: {
        paymentId: reconciled.paymentId,
        processedAt: new Date(),
        processingError: null
      },
      where: { deliveryKey }
    });
    return NextResponse.json({ received: true });
  } catch {
    await database.commercePaymentWebhook.updateMany({
      data: {
        processingError:
          "No fue posible verificar la orden notificada; se solicitará reintento."
      },
      where: { deliveryKey }
    });
    return NextResponse.json(
      { error: "No fue posible procesar la notificación." },
      { status: 500 }
    );
  }
}
