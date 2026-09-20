import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { isPrivilegedAdminRole } from "@/lib/auth/admin-access";
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
  const privilegedAdmin = admin && isPrivilegedAdminRole(admin.role) ? admin : null;
  if (admin && !privilegedAdmin) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar comprobantes de pago." },
      { status: 403 }
    );
  }
  if (!customer && !privilegedAdmin)
    return NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 });
  const proof = await database.commerceSpeiPaymentProof.findFirst({
    select: { mimeType: true, originalFileName: true, quoteId: true, storageKey: true },
    where: {
      id: proofId,
      ...(privilegedAdmin ? {} : { quote: { accountId: customer!.accountId } })
    }
  });
  if (!proof)
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });

  if (privilegedAdmin) {
    try {
      await database.adminAuditEvent.create({
        data: {
          metadata: { proofId, quoteId: proof.quoteId },
          type: "SPEI_PROOF_DOWNLOADED",
          userId: privilegedAdmin.id
        }
      });
    } catch {
      return NextResponse.json(
        { error: "La auditoría de seguridad no está disponible. Intenta más tarde." },
        { status: 503 }
      );
    }
  }

  try {
    const stream = await readSpeiStoredDocument(proof.storageKey);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${proof.originalFileName.replace(/[^a-zA-Z0-9._-]/gu, "-")}"`,
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
