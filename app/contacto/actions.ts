"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { EmailNotificationKind } from "@/app/generated/prisma/client";

import { database } from "@/lib/database";
import {
  createDiagnosticWhatsAppUrl,
  diagnosticRequestInputSchema,
  fingerprintDiagnosticRequest
} from "@/lib/diagnostics/request";
import { queueAdminEmailSafely } from "@/lib/notifications/outbox";

export type DiagnosticRequestState = {
  error?: string;
  success?: string;
  whatsappUrl?: string;
};

function clientAddress(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip") || null;
}

export async function submitDiagnosticRequest(
  _previousState: DiagnosticRequestState,
  formData: FormData
): Promise<DiagnosticRequestState> {
  void _previousState;
  const parsed = diagnosticRequestInputSchema.safeParse({
    budgetRange: formData.get("budgetRange") || undefined,
    companyName: formData.get("companyName") || undefined,
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    message: formData.get("message"),
    phone: formData.get("phone") || undefined,
    service: formData.get("service"),
    timeline: formData.get("timeline") || undefined,
    website: formData.get("website") || undefined
  });
  if (!parsed.success) {
    return { error: "Revisa los campos requeridos antes de enviar tu solicitud." };
  }

  const input = parsed.data;
  const requestHeaders = await headers();
  const fingerprint = fingerprintDiagnosticRequest(clientAddress(requestHeaders));
  const now = new Date();
  const recentFingerprintSince = new Date(now.getTime() - 60 * 60 * 1000);
  const recentEmailSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [recentFromAddress, recentFromEmail] = await Promise.all([
    fingerprint
      ? database.diagnosticRequest.count({
          where: {
            createdAt: { gte: recentFingerprintSince },
            requestFingerprint: fingerprint
          }
        })
      : Promise.resolve(0),
    database.diagnosticRequest.count({
      where: { createdAt: { gte: recentEmailSince }, email: input.email }
    })
  ]);

  if (recentFromAddress >= 3 || recentFromEmail >= 3) {
    return {
      error:
        "Ya recibimos varias solicitudes recientes. Escríbenos por WhatsApp si necesitas continuar ahora."
    };
  }

  try {
    await database.diagnosticRequest.create({
      data: {
        budgetRange: input.budgetRange ?? null,
        companyName: input.companyName ?? null,
        contactName: input.contactName,
        email: input.email,
        message: input.message,
        phone: input.phone ?? null,
        requestFingerprint: fingerprint,
        service: input.service,
        timeline: input.timeline ?? null
      }
    });
  } catch {
    return {
      error:
        "No pudimos registrar la solicitud en este momento. Puedes continuar directamente por WhatsApp."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/diagnosticos");
  after(() =>
    queueAdminEmailSafely({
      details: [
        { label: "Contacto", value: input.contactName },
        { label: "Correo", value: input.email },
        { label: "Servicio", value: input.service },
        ...(input.companyName ? [{ label: "Empresa", value: input.companyName }] : [])
      ],
      kind: EmailNotificationKind.DIAGNOSTIC_REQUEST_RECEIVED,
      subject: "JANVIER · Nueva solicitud de contacto",
      summary: "Se registró una nueva solicitud en el tablero privado de diagnósticos.",
      title: "Nueva solicitud recibida",
      tone: "signal"
    })
  );

  return {
    success:
      "Solicitud registrada. Puedes continuar por WhatsApp para acelerar la conversación.",
    whatsappUrl: createDiagnosticWhatsAppUrl(input)
  };
}
