import { createHash, randomBytes } from "node:crypto";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { z } from "zod";

import { database } from "@/lib/database";
import { getEmailConfiguration } from "@/lib/notifications/config";
import { isDeliveryQueueReady } from "@/lib/notifications/delivery-provider";
import {
  queueAdminEmailSafely,
  queueRecipientEmail
} from "@/lib/notifications/outbox";
import { createJanvierEmail } from "@/lib/notifications/templates";
import { hashPassword } from "@/lib/security/password";

const verificationLifetimeMs = 1000 * 60 * 60 * 24;
const mexicanTaxId = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/;

export const customerEnrollmentInput = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  contactPhone: z.string().trim().min(7).max(48),
  contactRole: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  purchaseIntent: z.string().trim().max(2000),
  purchaseVolume: z.enum(["PERSONAL", "OCCASIONAL", "REGULAR", "PROJECTS", "ENTERPRISE"]),
  taxId: z.string().trim().toUpperCase().regex(mexicanTaxId, "Ingresa un RFC válido."),
  termsAccepted: z.literal(true)
});

export type CustomerEnrollmentInput = z.infer<typeof customerEnrollmentInput>;

export type CustomerVerificationDelivery = {
  email: string;
  verificationId: string;
  verificationUrl: string;
};

export type CustomerLifecycleDelivery = {
  accountId: string;
  companyName: string;
  decision: "APPROVED" | "REJECTED" | "SUSPENDED";
  email: string;
};

export type CustomerCommerceDelivery = {
  accountId: string;
  companyName: string;
  email: string;
  reference: string;
  status?: "REQUESTED" | "REVIEWING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
  type: "ORDER" | "ORDER_STATUS" | "QUOTE";
};

type CustomerEmailResult = {
  error: "delivery-not-configured" | null;
  queued: number;
};

function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicAppUrl() {
  return getEmailConfiguration().appUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
}

function createVerificationUrl(token: string) {
  const url = new URL("/suministro/registro/verificar", publicAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

function createCustomerUrl(path: "/suministro/acceso" | "/suministro/mi-cuenta" | "/suministro/registro") {
  return new URL(path, publicAppUrl()).toString();
}

export async function customerEmailDeliveryIsConfigured() {
  const configuration = getEmailConfiguration();
  return Boolean(
    configuration.isEnabled && configuration.appUrl && (await isDeliveryQueueReady())
  );
}

export const verificationEmailDeliveryIsConfigured = customerEmailDeliveryIsConfigured;

async function queueCustomerEmail(input: {
  actionLabel: string;
  actionUrl: string;
  dedupeKey: string;
  details: Array<{ label: string; value: string }>;
  kind: EmailNotificationKind;
  recipient: string;
  subject: string;
  summary: string;
  title: string;
  tone: "alert" | "signal" | "neutral";
}): Promise<CustomerEmailResult> {
  if (!(await customerEmailDeliveryIsConfigured())) {
    return { error: "delivery-not-configured", queued: 0 };
  }
  const message = createJanvierEmail({
    actionLabel: input.actionLabel,
    actionUrl: input.actionUrl,
    details: input.details,
    eyebrow: input.kind.replaceAll("_", " / "),
    summary: input.summary,
    title: input.title,
    tone: input.tone
  });
  const queued = await queueRecipientEmail({
    dedupeKey: input.dedupeKey,
    html: message.html,
    kind: input.kind,
    priority: input.tone === "alert" ? 40 : 20,
    recipient: input.recipient,
    subject: input.subject,
    text: message.text
  });
  return { error: null, queued: queued.queued };
}

/**
 * Persists the commercial application and its one-time verification token.
 * The raw token exists only for the duration of this server request; the
 * database stores a SHA-256 digest.
 */
export async function createCustomerEnrollment(
  input: CustomerEnrollmentInput
): Promise<CustomerVerificationDelivery | null> {
  const email = input.email.toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + verificationLifetimeMs);

  return database.$transaction(async (transaction) => {
    const existingUser = await transaction.customerUser.findUnique({
      select: { emailVerifiedAt: true, id: true },
      where: { email }
    });
    if (existingUser?.emailVerifiedAt) return null;

    const verification = existingUser
      ? await transaction.customerEmailVerification.create({
          data: {
            deliveries: { create: {} },
            expiresAt,
            tokenHash: hashVerificationToken(token),
            userId: existingUser.id
          }
        })
      : await transaction.customerEmailVerification.create({
          data: {
            deliveries: { create: {} },
            expiresAt,
            tokenHash: hashVerificationToken(token),
            user: {
              create: {
                account: {
                  create: {
                    companyName: input.companyName,
                    contactName: input.contactName,
                    contactPhone: input.contactPhone,
                    contactRole: input.contactRole,
                    purchaseIntent: input.purchaseIntent || null,
                    purchaseVolume: input.purchaseVolume,
                    taxId: input.taxId
                  }
                },
                email,
                name: input.contactName
              }
            }
          }
        });

    return { email, verificationId: verification.id, verificationUrl: createVerificationUrl(token) };
  });
}

export async function sendCustomerVerificationEmail(input: CustomerVerificationDelivery) {
  return queueCustomerEmail({
    actionLabel: "Confirmar mi correo",
    actionUrl: input.verificationUrl,
    dedupeKey: `customer-verification:${input.verificationId}`,
    details: [{ label: "Vigencia", value: "24 horas" }],
    kind: EmailNotificationKind.CUSTOMER_EMAIL_VERIFICATION,
    recipient: input.email,
    subject: "JANVIER · Confirma tu correo para activar tu solicitud",
    summary:
      "Recibimos tu solicitud de cuenta comercial. Confirma tu correo para que nuestro equipo pueda revisar y habilitar tu acceso.",
    title: "Confirma tu correo",
    tone: "signal"
  });
}

const lifecycleCopy = {
  APPROVED: {
    kind: EmailNotificationKind.CUSTOMER_ACCOUNT_APPROVED,
    summary:
      "Tu cuenta comercial está activa. Ya puedes consultar condiciones, preparar cotizaciones y gestionar tus solicitudes desde JANVIER.",
    title: "Tu cuenta está lista",
    tone: "signal" as const
  },
  REJECTED: {
    kind: EmailNotificationKind.CUSTOMER_ACCOUNT_REJECTED,
    summary:
      "No fue posible habilitar la cuenta con la información actual. Puedes actualizar tu solicitud o contactar al equipo JANVIER.",
    title: "Necesitamos revisar tu solicitud",
    tone: "alert" as const
  },
  SUSPENDED: {
    kind: EmailNotificationKind.CUSTOMER_ACCOUNT_SUSPENDED,
    summary:
      "El acceso a tu cuenta comercial fue pausado. Nuestro equipo puede orientarte sobre los siguientes pasos.",
    title: "Tu acceso fue pausado",
    tone: "alert" as const
  }
} as const;

export async function sendCustomerLifecycleEmail(input: CustomerLifecycleDelivery) {
  const copy = lifecycleCopy[input.decision];
  const result = await queueCustomerEmail({
    actionLabel: input.decision === "APPROVED" ? "Entrar a mi cuenta" : "Revisar mi solicitud",
    actionUrl: createCustomerUrl(
      input.decision === "APPROVED" ? "/suministro/acceso" : "/suministro/registro"
    ),
    dedupeKey: `customer-lifecycle:${input.accountId}:${input.decision}`,
    details: [
      { label: "Empresa", value: input.companyName },
      { label: "Estado", value: input.decision }
    ],
    kind: copy.kind,
    recipient: input.email,
    subject: `JANVIER · ${copy.title}`,
    summary: copy.summary,
    title: copy.title,
    tone: copy.tone
  });
  await queueAdminEmailSafely({
    actionLabel: "Abrir clientes comerciales",
    actionUrl: `${publicAppUrl()}/admin/clientes`,
    dedupeKey: `admin-customer-lifecycle:${input.accountId}:${input.decision}`,
    details: [
      { label: "Empresa", value: input.companyName },
      { label: "Cliente", value: input.email },
      { label: "Estado", value: input.decision }
    ],
    kind: EmailNotificationKind.ADMIN_CUSTOMER_ACCOUNT_REQUESTED,
    priority: 35,
    subject: `JANVIER · Cuenta comercial ${input.decision.toLowerCase()}`,
    summary: "La condición de una cuenta comercial fue actualizada por administración.",
    title: "Cuenta comercial actualizada",
    tone: copy.tone
  });
  return result;
}

export async function sendCustomerCommerceEmail(input: CustomerCommerceDelivery) {
  const isQuote = input.type === "QUOTE";
  const isOrder = input.type === "ORDER";
  const kind = isQuote
    ? EmailNotificationKind.CUSTOMER_QUOTE_REQUESTED
    : isOrder
      ? EmailNotificationKind.CUSTOMER_ORDER_REQUESTED
      : EmailNotificationKind.CUSTOMER_ORDER_STATUS;
  const title = isQuote
    ? "Recibimos tu cotización"
    : isOrder
      ? "Recibimos tu pedido"
      : "Actualizamos tu pedido";
  const summary = isQuote
    ? "Nuestro equipo validará existencias, compatibilidad y condiciones antes de responderte."
    : isOrder
      ? "Tu solicitud fue registrada. Te avisaremos cada cambio operativo relevante."
      : "Tu pedido tiene una actualización. Consulta tu cuenta para ver el estado más reciente.";
  const result = await queueCustomerEmail({
    actionLabel: "Abrir mi cuenta",
    actionUrl: createCustomerUrl("/suministro/mi-cuenta"),
    dedupeKey: `customer-commerce:${input.type}:${input.reference}:${input.status ?? "INITIAL"}:${input.email}`,
    details: [
      { label: "Empresa", value: input.companyName },
      { label: "Referencia", value: input.reference },
      ...(input.status ? [{ label: "Estado", value: input.status }] : [])
    ],
    kind,
    recipient: input.email,
    subject: `JANVIER · ${title} · ${input.reference}`,
    summary,
    title,
    tone: "signal"
  });
  await queueAdminEmailSafely({
    actionLabel: isQuote ? "Abrir solicitudes" : "Abrir pedidos",
    actionUrl: `${publicAppUrl()}${isQuote ? "/admin/solicitudes" : "/admin/pedidos"}`,
    dedupeKey: `admin-commerce:${input.type}:${input.reference}:${input.status ?? "INITIAL"}`,
    details: [
      { label: "Empresa", value: input.companyName },
      { label: "Cliente", value: input.email },
      { label: "Referencia", value: input.reference },
      ...(input.status ? [{ label: "Estado", value: input.status }] : [])
    ],
    kind: isQuote
      ? EmailNotificationKind.ADMIN_COMMERCE_QUOTE_REQUESTED
      : EmailNotificationKind.ADMIN_COMMERCE_ORDER_REQUESTED,
    priority: 45,
    subject: `JANVIER · ${isQuote ? "Nueva cotización" : "Actividad de pedido"} · ${input.reference}`,
    summary: isQuote
      ? "Un cliente solicitó una nueva cotización comercial."
      : "Hay una actualización comercial de pedido que requiere seguimiento.",
    title: isQuote ? "Nueva solicitud de cotización" : "Actividad de pedido",
    tone: "signal"
  });
  return result;
}

export async function markCustomerVerificationDelivery(
  verificationId: string,
  status: "QUEUED" | "SENT" | "FAILED",
  failureSummary?: string
) {
  await database.customerEmailDelivery.updateMany({
    data: {
      attempts: { increment: 1 },
      ...(status === "SENT" ? { deliveredAt: new Date() } : {}),
      ...(status === "FAILED" ? { failureSummary } : {}),
      lastAttemptAt: new Date(),
      status
    },
    where: { verificationId }
  });
}

export async function confirmCustomerEmail(token: string, password: string) {
  const tokenHash = hashVerificationToken(token);
  const candidate = await database.customerEmailVerification.findUnique({
    select: {
      expiresAt: true,
      verifiedAt: true,
      user: { select: { emailVerifiedAt: true } }
    },
    where: { tokenHash }
  });
  if (
    !candidate ||
    candidate.verifiedAt ||
    candidate.expiresAt <= new Date() ||
    candidate.user.emailVerifiedAt
  ) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  const verified = await database.$transaction(async (transaction) => {
    const now = new Date();
    const verification = await transaction.customerEmailVerification.findUnique({
      include: {
        user: {
          include: {
            account: { select: { companyName: true } }
          }
        }
      },
      where: { tokenHash }
    });
    if (
      !verification ||
      verification.verifiedAt ||
      verification.expiresAt <= now ||
      verification.user.emailVerifiedAt
    ) {
      return null;
    }
    const claimed = await transaction.customerEmailVerification.updateMany({
      data: { verifiedAt: now },
      where: { id: verification.id, verifiedAt: null, expiresAt: { gt: now } }
    });
    if (!claimed.count) return null;
    const activated = await transaction.customerUser.updateMany({
      data: { emailVerifiedAt: now, passwordHash },
      where: { id: verification.userId, emailVerifiedAt: null }
    });
    if (!activated.count) return null;
    await transaction.customerAccount.update({
      data: { status: "PENDING_REVIEW" },
      where: { id: verification.user.accountId }
    });
    return {
      accountId: verification.user.accountId,
      companyName: verification.user.account.companyName,
      email: verification.user.email
    };
  });
  if (verified) {
    await queueAdminEmailSafely({
      actionLabel: "Revisar cuenta comercial",
      actionUrl: `${publicAppUrl()}/admin/clientes`,
      dedupeKey: `admin-customer-verified:${verified.accountId}`,
      details: [
        { label: "Empresa", value: verified.companyName },
        { label: "Correo confirmado", value: verified.email },
        { label: "Estado", value: "PENDING_REVIEW" }
      ],
      kind: EmailNotificationKind.ADMIN_CUSTOMER_ACCOUNT_REQUESTED,
      priority: 50,
      subject: "JANVIER · Nueva cuenta lista para revisión",
      summary:
        "Un cliente confirmó su correo y dejó una solicitud comercial lista para revisión.",
      title: "Cuenta comercial por revisar",
      tone: "signal"
    });
  }
  return verified;
}
