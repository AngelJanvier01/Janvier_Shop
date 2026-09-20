import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/lib/auth/current-customer";
import {
  removeStoredSpeiDocument,
  storeSpeiProof,
  validateSpeiProof
} from "@/lib/commerce/spei-documents";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SpeiProofRouteProps = { params: Promise<{ reference: string }> };

function fileFromFormData(value: FormDataEntryValue | null) {
  return value && typeof value !== "string" ? (value as File) : null;
}

export async function POST(request: Request, { params }: SpeiProofRouteProps) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const customer = await getCurrentCustomer();
  if (!customer)
    return NextResponse.json(
      { error: "Inicia sesión para adjuntar un comprobante." },
      { status: 401 }
    );
  const rateError = await assertRequestRate(
    request,
    customer.id,
    "spei-proof-upload",
    12,
    60_000
  );
  if (rateError) return rateError;
  const { reference } = await params;
  const form = await request.formData().catch(() => null);
  const file = form ? fileFromFormData(form.get("proof")) : null;
  if (!file)
    return NextResponse.json(
      { error: "Selecciona el comprobante para adjuntar." },
      { status: 400 }
    );
  let document;
  try {
    document = validateSpeiProof({
      bytes: new Uint8Array(await file.arrayBuffer()),
      declaredMimeType: file.type,
      originalFileName: file.name
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "El comprobante no es válido." },
      { status: 400 }
    );
  }
  const quote = await database.commerceSpeiQuote.findFirst({
    select: { id: true, order: { select: { reference: true } }, status: true },
    where: { accountId: customer.accountId, reference }
  });
  if (!quote)
    return NextResponse.json(
      { error: "La cotización no pertenece a esta cuenta." },
      { status: 404 }
    );
  if (!["AWAITING_PAYMENT", "PAYMENT_REPORTED"].includes(quote.status)) {
    return NextResponse.json(
      { error: "Esta cotización ya no permite comprobantes." },
      { status: 409 }
    );
  }
  let stored: Awaited<ReturnType<typeof storeSpeiProof>> | null = null;
  try {
    stored = await storeSpeiProof({ document, quoteId: quote.id });
    await database.commerceSpeiPaymentProof.create({
      data: {
        mimeType: stored.mimeType,
        originalFileName: stored.originalFileName,
        quoteId: quote.id,
        sha256: stored.sha256,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        uploadedById: customer.id
      }
    });
  } catch {
    if (stored) await removeStoredSpeiDocument(stored.storageKey);
    return NextResponse.json(
      { error: "No fue posible almacenar el comprobante." },
      { status: 500 }
    );
  }
  revalidatePath("/admin/pagos");
  revalidatePath(`/suministro/pagos/${quote.order.reference}`);
  return NextResponse.json({ ok: true });
}
