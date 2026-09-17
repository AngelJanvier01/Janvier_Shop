import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { database } from "@/lib/database";

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
  taxId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(mexicanTaxId, "Ingresa un RFC válido."),
  termsAccepted: z.literal(true)
});

export type CustomerEnrollmentInput = z.infer<typeof customerEnrollmentInput>;

export type CustomerVerificationDelivery = {
  email: string;
  verificationId: string;
  verificationUrl: string;
};

function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createVerificationUrl(token: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const url = new URL("/suministro/registro/verificar", siteUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Persists the commercial application and its one-time verification token.
 * The raw token is returned only to the server caller so it can be handed to
 * the configured email delivery provider; the database stores a hash only.
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

    if (existingUser?.emailVerifiedAt) {
      return null;
    }

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

    return {
      email,
      verificationId: verification.id,
      verificationUrl: createVerificationUrl(token)
    };
  });
}

export function verificationEmailDeliveryIsConfigured() {
  return Boolean(process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL?.trim());
}

/**
 * The platform owns customer data and email templates. A deployment may point
 * this narrow webhook at its approved mail provider without exposing that
 * provider's credentials to the app or browser.
 */
export async function sendCustomerVerificationEmail(input: CustomerVerificationDelivery) {
  const endpoint = process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL?.trim();
  if (!endpoint) {
    return { error: "delivery-not-configured" as const };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { error: "delivery-not-configured" as const };
  }

  const secret = process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_SECRET?.trim();
  const response = await fetch(url, {
    body: JSON.stringify({
      template: "customer-email-verification",
      to: input.email,
      verificationUrl: input.verificationUrl
    }),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {})
    },
    method: "POST"
  }).catch(() => null);

  return response?.ok ? { error: null } : { error: "delivery-failed" as const };
}

export async function markCustomerVerificationDelivery(
  verificationId: string,
  status: "SENT" | "FAILED",
  failureSummary?: string
) {
  await database.customerEmailDelivery.updateMany({
    data: {
      attempts: { increment: 1 },
      ...(status === "SENT" ? { deliveredAt: new Date() } : { failureSummary }),
      lastAttemptAt: new Date(),
      status
    },
    where: { verificationId }
  });
}

export async function confirmCustomerEmail(token: string, passwordHash: string) {
  const verification = await database.customerEmailVerification.findUnique({
    include: { user: { include: { account: true } } },
    where: { tokenHash: hashVerificationToken(token) }
  });

  if (
    !verification ||
    verification.verifiedAt ||
    verification.expiresAt.getTime() <= Date.now() ||
    verification.user.emailVerifiedAt
  ) {
    return false;
  }

  await database.$transaction([
    database.customerEmailVerification.update({
      data: { verifiedAt: new Date() },
      where: { id: verification.id }
    }),
    database.customerUser.update({
      data: { emailVerifiedAt: new Date(), passwordHash },
      where: { id: verification.userId }
    }),
    database.customerAccount.update({
      data: { status: "PENDING_REVIEW" },
      where: { id: verification.user.accountId }
    })
  ]);

  return true;
}
