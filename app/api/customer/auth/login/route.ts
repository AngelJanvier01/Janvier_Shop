import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createCustomerSession,
  customerSessionCookieName,
  customerSessionMaxAge
} from "@/lib/auth/customer-session";
import { database } from "@/lib/database";
import { verifyPassword } from "@/lib/security/password";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const loginInput = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256)
});

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }
  const parsed = loginInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de acceso inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const rateError = assertRequestRate(request, email, "customer-login", 10, 15 * 60_000);
  if (rateError) {
    return rateError;
  }

  const customer = await database.customerUser.findUnique({
    include: { account: true },
    where: { email }
  });
  const isValid =
    customer?.isActive &&
    customer.account.status === "APPROVED" &&
    customer.passwordHash &&
    (await verifyPassword(parsed.data.password, customer.passwordHash));
  if (!customer || !isValid) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos, o tu cuenta aún no está activa." },
      { status: 401 }
    );
  }

  const { expiresAt, token } = await createCustomerSession(customer.id);
  await database.customerUser.update({
    data: { lastLoginAt: new Date() },
    where: { id: customer.id }
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    expires: expiresAt,
    httpOnly: true,
    maxAge: customerSessionMaxAge,
    name: customerSessionCookieName,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: token
  });
  return response;
}
