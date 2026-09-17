import { createHash } from "node:crypto";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { extractProductSpecifications } from "@/lib/commerce/product-specifications";
import { database } from "@/lib/database";
import { dispatchPendingEmails } from "@/lib/notifications/dispatch";
import { getEmailConfiguration } from "@/lib/notifications/config";
import { isDeliveryQueueReady } from "@/lib/notifications/delivery-provider";
import { queueRecipientEmail } from "@/lib/notifications/outbox";
import { createJanvierEmail } from "@/lib/notifications/templates";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

type ProductEmailRouteProps = {
  params: Promise<{ slug: string }>;
};

const productEmailInput = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase())
});

function availability(product: { specialOrder: boolean; stockTotal: number | null }) {
  if (product.stockTotal !== null) {
    return `${product.stockTotal} ${product.stockTotal === 1 ? "unidad disponible" : "unidades disponibles"}`;
  }
  return product.specialOrder ? "Disponible bajo pedido" : "A confirmar al cotizar";
}

export async function POST(request: Request, { params }: ProductEmailRouteProps) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;

  const parsed = productEmailInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  const { slug } = await params;
  const email = parsed.data.email;
  const rateError = assertRequestRate(
    request,
    createHash("sha256").update(email).digest("base64url").slice(0, 18),
    "product-information",
    4,
    15 * 60_000
  );
  if (rateError) return rateError;

  if (!(await isDeliveryQueueReady())) {
    return NextResponse.json(
      {
        error:
          "El envío por correo está en configuración. Mientras tanto puedes descargar el PDF."
      },
      { status: 503 }
    );
  }

  const product = await database.product.findFirst({
    where: { slug, status: "PUBLISHED" }
  });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const configuration = getEmailConfiguration();
  const productUrl = configuration.appUrl
    ? `${configuration.appUrl}/suministro/catalogo/${product.slug}`
    : undefined;
  const specs = extractProductSpecifications(product.specifications).slice(0, 12);
  const message = createJanvierEmail({
    actionLabel: "Abrir ficha y descargar PDF",
    actionUrl: productUrl,
    details: [
      { label: "SKU", value: product.sku },
      { label: "Marca", value: product.brand ?? "A confirmar" },
      { label: "Disponibilidad total", value: availability(product) },
      ...specs
    ],
    eyebrow: "supply_system / ficha_técnica",
    summary: `${product.description} Esta ficha fue solicitada desde el catálogo de JANVIER. Podemos ayudarte a confirmar compatibilidad, existencia y condiciones para tu proyecto.`,
    title: product.name,
    tone: "signal"
  });
  const minute = Math.floor(Date.now() / 60_000);
  const recipientHash = createHash("sha256")
    .update(email)
    .digest("base64url")
    .slice(0, 22);
  const dedupeKey = `product-info:${product.id}:${recipientHash}:${minute}`;
  const queued = await queueRecipientEmail({
    dedupeKey,
    html: message.html,
    kind: EmailNotificationKind.PRODUCT_INFORMATION,
    priority: 20,
    recipient: email,
    subject: `JANVIER · Ficha técnica · ${product.name}`,
    text: message.text
  });

  if (!queued.queued) {
    return NextResponse.json(
      { message: "La ficha ya había sido solicitada hace unos instantes." },
      { status: 202 }
    );
  }

  const delivery = await dispatchPendingEmails(1, dedupeKey);
  return NextResponse.json(
    {
      message: delivery.sent
        ? "Listo. Enviamos la ficha a tu correo."
        : "Listo. La ficha quedó en cola y se enviará en cuanto el servicio esté disponible."
    },
    { status: 202, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}
