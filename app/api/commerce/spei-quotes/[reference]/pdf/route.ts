import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { readSpeiStoredDocument } from "@/lib/commerce/spei-documents";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SpeiPdfRouteProps = { params: Promise<{ reference: string }> };

function safeFilename(value: string) {
  return value.replace(/[^A-Z0-9-]/giu, "-").slice(0, 72) || "cotizacion-spei";
}

export async function GET(_request: Request, { params }: SpeiPdfRouteProps) {
  const [{ reference }, customer, admin] = await Promise.all([
    params,
    getCurrentCustomer(),
    getCurrentAdmin()
  ]);
  if (!customer && !admin) {
    return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  }
  const quote = await database.commerceSpeiQuote.findFirst({
    select: { pdfStorageKey: true, reference: true },
    where: { reference, ...(admin ? {} : { accountId: customer!.accountId }) }
  });
  if (!quote)
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  if (!quote.pdfStorageKey) {
    return NextResponse.json(
      { error: "El PDF definitivo aún no está disponible." },
      { status: 409 }
    );
  }
  try {
    const stream = await readSpeiStoredDocument(quote.pdfStorageKey);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="JANVIER-${safeFilename(quote.reference)}.pdf"`,
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "El documento privado no está disponible." },
      { status: 404 }
    );
  }
}
