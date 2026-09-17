import { readProductImageVariant } from "@/lib/product-images/storage";
import { NextResponse } from "next/server";

import { extractProductSpecifications } from "@/lib/commerce/product-specifications";
import { createProductInformationPdf } from "@/lib/commerce/product-pdf";
import { database } from "@/lib/database";

type ProductPdfRouteProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72);
  return normalized || "producto";
}

export async function GET(_request: Request, { params }: ProductPdfRouteProps) {
  const { slug } = await params;
  const product = await database.product.findFirst({
    include: {
      imageDerivatives: {
        orderBy: { sourcePosition: "asc" },
        select: { storageKey: true },
        take: 1,
        where: { status: "APPROVED" }
      }
    },
    where: { slug, status: "PUBLISHED" }
  });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  let image: Buffer | null = null;
  const storageKey = product.imageDerivatives[0]?.storageKey;
  if (storageKey) {
    image = await readProductImageVariant(storageKey, "png").catch(() => null);
  }

  const pdf = await createProductInformationPdf({
    brand: product.brand,
    category: product.category,
    description: product.description,
    image,
    name: product.name,
    partNumber: product.partNumber,
    sku: product.sku,
    specialOrder: product.specialOrder,
    specifications: extractProductSpecifications(product.specifications),
    stockTotal: product.stockTotal,
    upc: product.upc,
    warrantyYears: product.warrantyYears
  });
  const filename = `JANVIER-${safeFilename(product.name)}-${safeFilename(product.sku)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
