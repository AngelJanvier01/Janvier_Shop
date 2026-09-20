import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { readSpeiStoredDocument } from "@/lib/commerce/spei-documents";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SpeiProofRouteProps = { params: Promise<{ proofId: string }> };

export async function GET(_request: Request, { params }: SpeiProofRouteProps) {
  const [{ proofId }, customer, admin] = await Promise.all([
    params,
    getCurrentCustomer(),
    getCurrentAdmin()
  ]);
  if (!customer && !admin)
    return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  const proof = await database.commerceSpeiPaymentProof.findFirst({
    select: { mimeType: true, originalFileName: true, storageKey: true },
    where: {
      id: proofId,
      ...(admin ? {} : { quote: { accountId: customer!.accountId } })
    }
  });
  if (!proof)
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  try {
    const stream = await readSpeiStoredDocument(proof.storageKey);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${proof.originalFileName.replace(/["\\]/gu, "-")}"`,
        "Content-Type": proof.mimeType,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "El comprobante privado no está disponible." },
      { status: 404 }
    );
  }
}
