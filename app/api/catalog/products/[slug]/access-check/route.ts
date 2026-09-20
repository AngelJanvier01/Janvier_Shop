import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const input = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase())
});

/**
 * Keeps the information-request flow personal: an existing customer is asked
 * to sign in before we send or create a request under a different identity.
 */
export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;

  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }

  const email = parsed.data.email;
  const rateError = await assertRequestRate(
    request,
    createHash("sha256").update(email).digest("base64url").slice(0, 18),
    "catalog-account-check",
    5,
    15 * 60_000
  );
  if (rateError) return rateError;

  const currentCustomer = await getCurrentCustomer();
  if (currentCustomer?.email.toLowerCase() === email) {
    return NextResponse.json(
      { status: "SIGNED_IN" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const account = await database.customerUser.findFirst({
    select: { id: true },
    where: { email, emailVerifiedAt: { not: null }, isActive: true }
  });
  return NextResponse.json(
    { status: account ? "LOGIN_REQUIRED" : "GUEST" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
