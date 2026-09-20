import { NextResponse } from "next/server";

import { isPrivilegedAdminRole } from "@/lib/auth/admin-access";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import {
  customerDocumentDownloadFilename,
  readCustomerEnrollmentDocument
} from "@/lib/customer-accounts/documents";
import { database } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!isPrivilegedAdminRole(admin.role)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar documentación fiscal." },
      { status: 403 }
    );
  }

  const { documentId } = await context.params;
  const document = await database.customerEnrollmentDocument.findUnique({
    select: { accountId: true, contentType: true, filename: true, storageKey: true },
    where: { id: documentId }
  });
  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  try {
    // A sensitive download is never served if we cannot leave an audit trail.
    await database.adminAuditEvent.create({
      data: {
        metadata: { accountId: document.accountId, documentId },
        type: "CUSTOMER_DOCUMENT_DOWNLOADED",
        userId: admin.id
      }
    });
  } catch {
    return NextResponse.json(
      { error: "La auditoría de seguridad no está disponible. Intenta más tarde." },
      { status: 503 }
    );
  }

  try {
    const contents = await readCustomerEnrollmentDocument(document.storageKey);
    return new NextResponse(contents, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${customerDocumentDownloadFilename(document.filename)}"`,
        "content-security-policy": "sandbox",
        "content-type": document.contentType,
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Documento no disponible." }, { status: 404 });
  }
}
