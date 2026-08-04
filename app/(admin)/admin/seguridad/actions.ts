"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { queueAdminEmailSafely } from "@/lib/notifications/outbox";
import { hashPassword, verifyPassword } from "@/lib/security/password";

const passwordChangeInput = z
  .object({
    confirmation: z.string().min(12).max(256),
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256)
  })
  .refine((value) => value.newPassword === value.confirmation, {
    message: "La confirmación no coincide con la nueva contraseña.",
    path: ["confirmation"]
  });

export type PasswordChangeState = { error?: string; success?: string };

function requestAddress(requestHeaders: Headers) {
  return (
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "No disponible"
  );
}

export async function changeCurrentAdminPassword(
  _previousState: PasswordChangeState,
  formData: FormData
): Promise<PasswordChangeState> {
  void _previousState;
  const admin = await requireCurrentAdmin();
  const parsed = passwordChangeInput.safeParse({
    confirmation: formData.get("confirmation"),
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword")
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos de acceso." };
  }
  if (!(await verifyPassword(parsed.data.currentPassword, admin.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }
  if (await verifyPassword(parsed.data.newPassword, admin.passwordHash)) {
    return { error: "La nueva contraseña debe ser diferente a la actual." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await database.$transaction([
    database.adminUser.update({ data: { passwordHash }, where: { id: admin.id } }),
    database.adminSession.updateMany({
      data: { invalidatedAt: new Date() },
      where: { invalidatedAt: null, userId: admin.id }
    })
  ]);
  const address = requestAddress(await headers());
  after(() =>
    queueAdminEmailSafely({
      details: [
        { label: "Cuenta", value: admin.email },
        { label: "Origen", value: address },
        { label: "Sesiones", value: "Todas invalidadas" }
      ],
      kind: EmailNotificationKind.ADMIN_PASSWORD_CHANGED,
      subject: "JANVIER · Contraseña administrativa actualizada",
      summary:
        "La contraseña se actualizó y se invalidaron todas las sesiones administrativas activas.",
      title: "Contraseña actualizada",
      tone: "alert"
    })
  );
  return { success: "Contraseña actualizada. Inicia sesión de nuevo para continuar." };
}
