import { after, NextResponse } from "next/server";
import { z } from "zod";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import {
  adminSessionCookieName,
  adminSessionMaxAge,
  createAdminSession
} from "@/lib/auth/admin-session";
import { database } from "@/lib/database";
import { queueAdminEmailSafely } from "@/lib/notifications/outbox";
import { verifyPassword } from "@/lib/security/password";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const loginInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256)
});

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;

  const parsed = loginInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de acceso invalidos." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const rateError = assertRequestRate(request, email, "admin-login", 10, 15 * 60_000);
  if (rateError) {
    const hour = new Date().toISOString().slice(0, 13);
    after(() =>
      queueAdminEmailSafely({
        dedupeKey: `admin-login-rate-limit:${email}:${hour}`,
        details: [
          { label: "Cuenta objetivo", value: email },
          { label: "Ventana", value: "15 minutos" },
          { label: "Severidad", value: "LIMITED_LOGIN_ATTEMPTS" }
        ],
        kind: EmailNotificationKind.ADMIN_LOGIN_RATE_LIMITED,
        priority: 75,
        subject: "JANVIER · Intentos de acceso limitados",
        summary:
          "Se bloqueo temporalmente una serie de intentos de acceso a administracion.",
        title: "Intentos de acceso limitados",
        tone: "alert"
      })
    );
    return rateError;
  }

  const admin = await database.adminUser.findUnique({ where: { email } });
  const isValid = admin?.isActive
    ? await verifyPassword(parsed.data.password, admin.passwordHash)
    : false;
  if (!admin || !isValid) {
    return NextResponse.json(
      { error: "Correo o contrasena incorrectos." },
      { status: 401 }
    );
  }

  const { expiresAt, id: sessionId, token } = await createAdminSession(admin.id);
  await database.adminUser.update({
    data: { lastLoginAt: new Date() },
    where: { id: admin.id }
  });
  after(() =>
    queueAdminEmailSafely({
      dedupeKey: `admin-login:${sessionId}`,
      details: [
        { label: "Cuenta", value: admin.email },
        { label: "Evento", value: "ADMIN_LOGIN_SUCCESS" },
        { label: "Sesion valida hasta", value: expiresAt.toLocaleString("es-MX") }
      ],
      kind: EmailNotificationKind.ADMIN_LOGIN_SUCCESS,
      priority: 50,
      subject: "JANVIER · Nuevo acceso administrativo",
      summary: "Se inicio una nueva sesion en el panel administrativo.",
      title: "Acceso administrativo confirmado",
      tone: "signal"
    })
  );

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    expires: expiresAt,
    httpOnly: true,
    maxAge: adminSessionMaxAge,
    name: adminSessionCookieName,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: token
  });
  return response;
}
