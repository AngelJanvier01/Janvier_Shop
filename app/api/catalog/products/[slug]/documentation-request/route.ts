import { createHash } from "node:crypto";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { database } from "@/lib/database";
import { getEmailConfiguration } from "@/lib/notifications/config";
import { isDeliveryQueueReady } from "@/lib/notifications/delivery-provider";
import { queueAdminEmailSafely, queueRecipientEmail } from "@/lib/notifications/outbox";
import { createJanvierEmail } from "@/lib/notifications/templates";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

type ProductDocumentationRouteProps = { params: Promise<{ slug: string }> };

const input = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase())
});

export async function POST(request: Request, { params }: ProductDocumentationRouteProps) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;

  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  const email = parsed.data.email;
  const rateError = await assertRequestRate(
    request,
    createHash("sha256").update(email).digest("base64url").slice(0, 18),
    "product-documentation-request",
    3,
    15 * 60_000
  );
  if (rateError) return rateError;

  const currentCustomer = await getCurrentCustomer();
  if (currentCustomer?.email.toLowerCase() !== email) {
    const existingCustomer = await database.customerUser.findFirst({
      select: { id: true },
      where: { email, emailVerifiedAt: { not: null }, isActive: true }
    });
    if (existingCustomer) {
      return NextResponse.json(
        {
          code: "LOGIN_REQUIRED",
          error: "Inicia sesión para continuar con tu cuenta JANVIER."
        },
        { status: 401 }
      );
    }
  }

  const { slug } = await params;
  const product = await database.product.findFirst({
    select: { id: true, name: true, sku: true, slug: true },
    where: { slug, status: "PUBLISHED" }
  });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const configuration = getEmailConfiguration();
  const productUrl = configuration.appUrl
    ? `${configuration.appUrl}/suministro/catalogo/${product.slug}`
    : undefined;
  const minute = Math.floor(Date.now() / 60_000);
  const recipientHash = createHash("sha256")
    .update(email)
    .digest("base64url")
    .slice(0, 22);
  const requestKey = `product-documents:${product.id}:${recipientHash}:${minute}`;

  await queueAdminEmailSafely({
    actionLabel: "Abrir ficha del producto",
    actionUrl: productUrl,
    dedupeKey: `admin-${requestKey}`,
    details: [
      { label: "Producto", value: product.name },
      { label: "SKU", value: product.sku },
      { label: "Correo de contacto", value: email },
      { label: "Solicitud", value: "Manuales, diagramas o certificados" }
    ],
    kind: EmailNotificationKind.PRODUCT_INFORMATION,
    priority: 42,
    subject: `JANVIER · Solicitud de documentación · ${product.sku}`,
    summary: "Un visitante solicitó documentación técnica para un producto del catálogo.",
    title: "Solicitud de documentación",
    tone: "signal"
  });

  if (await isDeliveryQueueReady()) {
    const message = createJanvierEmail({
      actionLabel: "Abrir ficha del producto",
      actionUrl: productUrl,
      details: [
        { label: "Producto", value: product.name },
        { label: "SKU", value: product.sku },
        { label: "Solicitud", value: "Manuales, diagramas o certificados" }
      ],
      eyebrow: "suministro / documentación técnica",
      summary:
        "Recibimos tu solicitud. Nuestro equipo revisará la documentación disponible y te responderá con la información correspondiente.",
      title: "Estamos preparando la información",
      tone: "signal"
    });
    await queueRecipientEmail({
      dedupeKey: requestKey,
      html: message.html,
      kind: EmailNotificationKind.PRODUCT_INFORMATION,
      priority: 20,
      recipient: email,
      subject: `JANVIER · Solicitud de información · ${product.name}`,
      text: message.text
    });
  }

  return NextResponse.json(
    {
      message:
        "Listo. Recibimos tu solicitud y revisaremos los manuales, diagramas o certificados disponibles."
    },
    { status: 202, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
