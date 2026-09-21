import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/lib/auth/current-customer";
import {
  createMercadoPagoOrder,
  getMercadoPagoCredentialEnvironment,
  getMercadoPagoOrder,
  mercadoPagoCheckoutInputSchema,
  MercadoPagoConfigurationError,
  MercadoPagoRequestError
} from "@/lib/commerce/mercado-pago";
import {
  reconcileMercadoPagoOrder,
  recordMercadoPagoOrderCreation
} from "@/lib/commerce/mercado-pago-reconciliation";
import {
  calculateSnapshotTotal,
  getPaymentConfigurationView,
  isPaymentMethodAvailable,
  lockCommerceOrder,
  makePaymentAttemptReference,
  makeProviderIdempotencyKey,
  synchronizeOrderPaymentState
} from "@/lib/commerce/payment-core";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const customer = await getCurrentCustomer();
  if (!customer)
    return NextResponse.json({ error: "Inicia sesión para pagar." }, { status: 401 });
  const rateError = await assertRequestRate(
    request,
    customer.id,
    "mercado-pago-checkout",
    8,
    60_000
  );
  if (rateError) return rateError;
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json(
      { error: "Formato de solicitud no válido." },
      { status: 415 }
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = mercadoPagoCheckoutInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "No fue posible preparar el pago." },
      { status: 400 }
    );
  }

  let credentialEnvironment: "disabled" | "sandbox" | "production";
  try {
    credentialEnvironment = getMercadoPagoCredentialEnvironment();
  } catch {
    return NextResponse.json(
      { error: "La configuración de pago no está disponible." },
      { status: 503 }
    );
  }
  if (credentialEnvironment === "disabled") {
    return NextResponse.json(
      { error: "El pago con Mercado Pago no está habilitado actualmente." },
      { status: 503 }
    );
  }

  let prepared: {
    amount: number;
    description: string;
    externalReference: string;
    id: string;
    idempotencyKey: string;
    items: Array<{
      description: string | null;
      name: string | null;
      quantity: number;
      sku: string | null;
      unitPriceWithTax: number;
    }>;
  };
  try {
    prepared = await database.$transaction(async (transaction) => {
      const order = await transaction.commerceOrder.findFirst({
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              quantity: true,
              snapshotName: true,
              snapshotSku: true,
              snapshotUnitPriceWithTax: true
            }
          }
        },
        where: { accountId: customer.accountId, reference: parsed.data.orderReference }
      });
      if (!order) throw new Error("El pedido no pertenece a esta cuenta.");
      await lockCommerceOrder(transaction, order.id);
      const configuration = await transaction.commercePaymentConfiguration.findUnique({
        where: { installationKey: "default" }
      });
      if (
        Boolean(configuration?.mercadoPagoSandbox) !==
        (credentialEnvironment === "sandbox")
      ) {
        throw new Error(
          "El modo de Mercado Pago no coincide con las credenciales configuradas."
        );
      }
      if (
        !isPaymentMethodAvailable(
          getPaymentConfigurationView(configuration),
          "MERCADO_PAGO"
        )
      ) {
        throw new Error("El pago con Mercado Pago no está habilitado actualmente.");
      }
      if (order.status !== "CONFIRMED") {
        throw new Error(
          "Primero confirmaremos existencia, entrega y condiciones del pedido."
        );
      }
      if (order.paymentStatus === "PAID")
        throw new Error("Este pedido ya cuenta con un pago confirmado.");
      const activeAttempt = await transaction.commercePayment.findFirst({
        select: { id: true },
        where: {
          orderId: order.id,
          provider: "MERCADO_PAGO",
          status: { in: ["DRAFT", "PENDING"] },
          updatedAt: { gt: new Date(Date.now() - 15 * 60_000) }
        }
      });
      if (activeAttempt) {
        throw new Error(
          "Ya hay un intento de pago en verificación. Espera unos minutos antes de reintentar."
        );
      }
      const amount = calculateSnapshotTotal(order.items);
      const payment = await transaction.commercePayment.create({
        data: {
          accountId: customer.accountId,
          amount,
          events: {
            create: {
              nextStatus: "PENDING",
              summary: "Intento de pago Mercado Pago creado desde Checkout Bricks.",
              type: "ATTEMPT_CREATED"
            }
          },
          externalReference: makePaymentAttemptReference(order.reference),
          idempotencyKey: makeProviderIdempotencyKey(),
          orderId: order.id,
          paymentMethodId: parsed.data.paymentMethodId,
          paymentMethodType: parsed.data.paymentMethodType,
          provider: "MERCADO_PAGO",
          requestedById: customer.id,
          status: "PENDING"
        },
        select: { externalReference: true, id: true, idempotencyKey: true }
      });
      await synchronizeOrderPaymentState(transaction, order.id);
      return {
        amount,
        description: `Pedido JANVIER ${order.reference}`,
        externalReference: payment.externalReference,
        id: payment.id,
        idempotencyKey: payment.idempotencyKey,
        items: order.items.map((item) => ({
          description: item.snapshotName,
          name: item.snapshotName,
          quantity: item.quantity,
          sku: item.snapshotSku,
          unitPriceWithTax: Number(item.snapshotUnitPriceWithTax)
        }))
      };
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible preparar el pago."
      },
      { status: 409 }
    );
  }

  try {
    const created = await createMercadoPagoOrder({
      ...prepared,
      customerEmail: customer.email,
      installments: parsed.data.installments,
      payerIdentification: parsed.data.payerIdentification,
      paymentMethodId: parsed.data.paymentMethodId,
      paymentMethodType: parsed.data.paymentMethodType,
      token: parsed.data.token
    });
    await recordMercadoPagoOrderCreation({ order: created, paymentId: prepared.id });
    const verified = await getMercadoPagoOrder(created.id);
    const reconciled = await reconcileMercadoPagoOrder({
      order: verified,
      paymentId: prepared.id,
      source: "CHECKOUT"
    });
    return NextResponse.json({
      status: reconciled.status,
      success: reconciled.status === "APPROVED"
    });
  } catch (error) {
    const safeMessage =
      error instanceof MercadoPagoConfigurationError
        ? "La configuración de pago no está completa. Contacta a JANVIER."
        : error instanceof MercadoPagoRequestError && !error.retryable
          ? "El pago no pudo aprobarse. Revisa los datos o intenta otro método."
          : "Estamos verificando la operación. No reintentes el cargo de inmediato.";
    if (error instanceof MercadoPagoRequestError && !error.retryable) {
      await database.$transaction(async (transaction) => {
        const payment = await transaction.commercePayment.findUnique({
          select: { orderId: true, status: true },
          where: { id: prepared.id }
        });
        if (!payment) return;
        await lockCommerceOrder(transaction, payment.orderId);
        await transaction.commercePayment.update({
          data: { rejectedAt: new Date(), status: "REJECTED" },
          where: { id: prepared.id }
        });
        await synchronizeOrderPaymentState(transaction, payment.orderId);
      });
    }
    const status =
      error instanceof MercadoPagoRequestError && !error.retryable ? 422 : 202;
    return NextResponse.json({ error: safeMessage, pending: status === 202 }, { status });
  }
}
