import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { createCommerceOrderPdf } from "@/lib/commerce/order-pdf";
import { database } from "@/lib/database";

type CommerceOrderPdfRouteProps = {
  params: Promise<{ reference: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeFilename(value: string) {
  return value.replace(/[^A-Z0-9-]/giu, "-").slice(0, 72) || "pedido";
}

export async function GET(request: Request, { params }: CommerceOrderPdfRouteProps) {
  const [{ reference }, customer, admin] = await Promise.all([
    params,
    getCurrentCustomer(),
    getCurrentAdmin()
  ]);
  if (!customer && !admin) {
    return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  }

  const order = await database.commerceOrder.findFirst({
    include: {
      account: { select: { companyName: true, contactName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          quantity: true,
          snapshotBrand: true,
          snapshotName: true,
          snapshotSku: true,
          snapshotUnitPriceWithTax: true
        }
      }
    },
    where: {
      reference,
      ...(admin ? {} : { accountId: customer!.accountId })
    }
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }

  const brandLogo = await readFile(
    join(process.cwd(), "public", "brand", "angel_janvier_logo_black_1600.png")
  ).catch(() => null);
  const pdf = await createCommerceOrderPdf(
    {
      accountName: order.account.companyName,
      contactName: order.account.contactName,
      customerNotes: order.customerNotes,
      items: order.items.map((item) => ({
        brand: item.snapshotBrand,
        name: item.snapshotName,
        priceWithTax:
          item.snapshotUnitPriceWithTax === null
            ? null
            : Number(item.snapshotUnitPriceWithTax),
        quantity: item.quantity,
        sku: item.snapshotSku
      })),
      reference: order.reference,
      requestedAt: order.requestedAt,
      status: order.status
    },
    brandLogo
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="JANVIER-${safeFilename(order.reference)}.pdf"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
