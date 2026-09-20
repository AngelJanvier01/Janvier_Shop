import { NextResponse } from "next/server";

import {
  createCustomerEnrollment,
  customerEnrollmentInput,
  markCustomerVerificationDelivery,
  sendCustomerVerificationEmail,
  verificationEmailDeliveryIsConfigured
} from "@/lib/customer-accounts/enrollment";
import {
  customerDocumentExtension,
  isValidCustomerDocumentContent,
  removeCustomerEnrollmentDocument,
  writeCustomerEnrollmentDocument
} from "@/lib/customer-accounts/documents";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }

  const isMultipart = request.headers
    .get("content-type")
    ?.toLowerCase()
    .startsWith("multipart/form-data");
  const formData = isMultipart ? await request.formData().catch(() => null) : null;
  const document = formData?.get("taxCertificate");
  const payload: unknown = formData
    ? {
        companyName: String(formData.get("companyName") ?? ""),
        contactName: String(formData.get("contactName") ?? ""),
        contactPhone: String(formData.get("contactPhone") ?? ""),
        contactRole: String(formData.get("contactRole") ?? ""),
        email: String(formData.get("email") ?? ""),
        formOpenedAt: Number(formData.get("formOpenedAt")),
        isBusiness: formData.get("isBusiness") === "true",
        purchaseIntent: String(formData.get("purchaseIntent") ?? ""),
        purchaseVolume: String(formData.get("purchaseVolume") ?? ""),
        taxId: String(formData.get("taxId") ?? ""),
        termsAccepted: formData.get("termsAccepted") === "true",
        website: String(formData.get("website") ?? "")
      }
    : await request.json().catch(() => null);
  const parsed = customerEnrollmentInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa los datos de tu solicitud." },
      { status: 400 }
    );
  }

  const botPayload = payload as { formOpenedAt?: unknown; website?: unknown } | null;
  const openedAt =
    typeof botPayload?.formOpenedAt === "number" ? botPayload.formOpenedAt : Number.NaN;
  const honeypotFilled =
    typeof botPayload?.website === "string" && botPayload.website.trim();
  if (honeypotFilled || !Number.isFinite(openedAt) || Date.now() - openedAt < 1_200) {
    // Do not help automated clients distinguish a trap from a valid submission.
    return NextResponse.json({ ok: true });
  }

  const isTaxCertificate = document instanceof File;
  if (!parsed.data.isBusiness) {
    if (
      !isTaxCertificate ||
      !customerDocumentExtension(document.type) ||
      document.size > 8_000_000
    ) {
      return NextResponse.json(
        {
          error:
            "Adjunta tu Constancia de Situación Fiscal en PDF, JPG o PNG (máximo 8 MB)."
        },
        { status: 400 }
      );
    }
  }

  const email = parsed.data.email.toLowerCase();
  const rateError = await assertRequestRate(
    request,
    email,
    "customer-enrollment",
    4,
    15 * 60_000
  );
  if (rateError) {
    return rateError;
  }

  if (!(await verificationEmailDeliveryIsConfigured())) {
    return NextResponse.json(
      { error: "El registro está en preparación. Vuelve a intentarlo muy pronto." },
      { status: 503 }
    );
  }

  const enrollment = await createCustomerEnrollment(parsed.data);
  if (!enrollment) {
    return NextResponse.json({ ok: true });
  }

  if (isTaxCertificate) {
    if (!enrollment.accountId) {
      return NextResponse.json(
        { error: "No fue posible resguardar tu documento." },
        { status: 500 }
      );
    }
    const contents = Buffer.from(await document.arrayBuffer());
    if (!isValidCustomerDocumentContent(document.type, contents)) {
      return NextResponse.json(
        {
          error:
            "El archivo no coincide con el formato indicado. Intenta con tu CSF original."
        },
        { status: 400 }
      );
    }
    const stored = await writeCustomerEnrollmentDocument({
      accountId: enrollment.accountId,
      contentType: document.type,
      contents,
      filename: document.name
    });
    try {
      await database.customerEnrollmentDocument.create({
        data: {
          accountId: enrollment.accountId,
          bytes: contents.byteLength,
          contentType: document.type,
          filename: stored.filename,
          storageKey: stored.storageKey
        }
      });
    } catch (error) {
      await removeCustomerEnrollmentDocument(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  const delivery = await sendCustomerVerificationEmail(enrollment);
  if (delivery.error) {
    await markCustomerVerificationDelivery(
      enrollment.verificationId,
      "FAILED",
      delivery.error
    );
    return NextResponse.json(
      { error: "No fue posible enviar la verificación. Intenta de nuevo más tarde." },
      { status: 503 }
    );
  }

  await markCustomerVerificationDelivery(enrollment.verificationId, "QUEUED");
  return NextResponse.json({ ok: true });
}
