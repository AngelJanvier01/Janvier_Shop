import { NextResponse } from "next/server";
import { z } from "zod";

import {
  adminSessionCookieName,
  adminSessionMaxAge,
  createAdminSession
} from "@/lib/auth/admin-session";
import { database } from "@/lib/database";
import { verifyPassword } from "@/lib/security/password";

const loginInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256)
});

export async function POST(request: Request) {
  const parsed = loginInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de acceso inválidos." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const admin = await database.adminUser.findUnique({ where: { email } });
  const isValid = admin?.isActive
    ? await verifyPassword(parsed.data.password, admin.passwordHash)
    : false;

  if (!admin || !isValid) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos." },
      { status: 401 }
    );
  }

  const { expiresAt, token } = await createAdminSession(admin.id);
  await database.adminUser.update({
    data: { lastLoginAt: new Date() },
    where: { id: admin.id }
  });

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
