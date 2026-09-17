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

export type CustomerLifecycleDelivery = {
  companyName: string;
  decision: "APPROVED" | "REJECTED" | "SUSPENDED";
  email: string;
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

function createCustomerUrl(path: "/suministro/acceso" | "/suministro/registro") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  return new URL(path, siteUrl).toString();
}

async function postCustomerEmail(payload: Record<string, string>) {
  const endpoint = process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_URL?.trim();
  if (!endpoint) return { error: "delivery-not-configured" as const };

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { error: "delivery-not-configured" as const };
  }

  const secret = process.env.CUSTOMER_EMAIL_DELIVERY_WEBHOOK_SECRET?.trim();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {})
      },
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    }).catch(() => null);
    if (response?.ok) return { error: null };
    if (response && response.status < 500 && response.status !== 429) break;
  }

  return { error: "delivery-failed" as const };
}

/**
 * The platform owns customer data and email templates. A deployment may point
 * this narrow webhook at its approved mail provider without exposing that
 * provider's credentials to the app or browser.
 */
export async function sendCustomerVerificationEmail(input: CustomerVerificationDelivery) {
  return postCustomerEmail({
    template: "customer-email-verification",
    to: input.email,
    verificationUrl: input.verificationUrl
  });
}

export async function sendCustomerLifecycleEmail(input: CustomerLifecycleDelivery) {
  return postCustomerEmail({
    accountUrl: createCustomerUrl(
      input.decision === "APPROVED" ? "/suministro/acceso" : "/suministro/registro"
    ),
    companyName: input.companyName,
    decision: input.decision,
    template: `customer-account-${input.decision.toLowerCase()}`,
    to: input.email
  });
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
  return database.$transaction(
    async (transaction) => {
      const now = new Date();
      const verification = await transaction.customerEmailVerification.findUnique({
        include: { user: { select: { accountId: true, emailVerifiedAt: true } } },
        where: { tokenHash: hashVerificationToken(token) }
      });
      if (
        !verification ||
        verification.verifiedAt ||
        verification.expiresAt <= now ||
        verification.user.emailVerifiedAt
      ) {
        return false;
      }

      const claimed = await transaction.customerEmailVerification.updateMany({
        data: { verifiedAt: now },
        where: { id: verification.id, verifiedAt: null, expiresAt: { gt: now } }
      });
      if (!claimed.count) return false;

      const activated = await transaction.customerUser.updateMany({
        data: { emailVerifiedAt: now, passwordHash },
        where: { id: verification.userId, emailVerifiedAt: null }
      });
      if (!activated.count) return false;

      await transaction.customerAccount.update({
        data: { status: "PENDING_REVIEW" },
        where: { id: verification.user.accountId }
      });
      return true;
    },
    { isolationLevel: "Serializable" }
  );
}
