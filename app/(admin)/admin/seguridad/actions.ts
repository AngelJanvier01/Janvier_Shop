"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import {
  AdminAuditEventType,
  EmailNotificationKind
} from "@/app/generated/prisma/client";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { queueAdminEmailSafely } from "@/lib/notifications/outbox";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { isHeaderRateLimited } from "@/lib/security/request-guard";

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

export async function changeCurrentAdminPassword(
  _previousState: PasswordChangeState,
  formData: FormData
): Promise<PasswordChangeState> {
  void _previousState;
  const admin = await requireCurrentAdmin();
  const requestHeaders = await headers();
  if (
    isHeaderRateLimited(requestHeaders, admin.id, "admin-password-change", 5, 15 * 60_000)
  ) {
    return {
      error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo."
    };
  }
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
    }),
    database.adminAuditEvent.create({
      data: { type: AdminAuditEventType.PASSWORD_CHANGED, userId: admin.id }
    })
  ]);
  after(() =>
    queueAdminEmailSafely({
      details: [
        { label: "Cuenta", value: admin.email },
        { label: "Evento", value: "PASSWORD_CHANGED" },
        { label: "Sesiones", value: "Todas invalidadas" }
      ],
      dedupeKey: `password-change:${admin.id}:${Date.now()}`,
      kind: EmailNotificationKind.ADMIN_PASSWORD_CHANGED,
      priority: 100,
      subject: "JANVIER · Contraseña administrativa actualizada",
      summary:
        "La contraseña se actualizó y se invalidaron todas las sesiones administrativas activas.",
      title: "Contraseña actualizada",
      tone: "alert"
    })
  );
  return { success: "Contraseña actualizada. Inicia sesión de nuevo para continuar." };
}
