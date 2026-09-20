import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { readCustomerEnrollmentDocument } from "@/lib/customer-accounts/documents";
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

  const { documentId } = await context.params;
  const document = await database.customerEnrollmentDocument.findUnique({
    select: { contentType: true, filename: true, storageKey: true },
    where: { id: documentId }
  });
  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  try {
    const contents = await readCustomerEnrollmentDocument(document.storageKey);
    return new NextResponse(contents, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="${document.filename.replaceAll('"', "")}"`,
        "content-security-policy": "sandbox",
        "content-type": document.contentType,
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Documento no disponible." }, { status: 404 });
  }
}
