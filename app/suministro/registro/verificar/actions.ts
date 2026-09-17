"use server";

import { z } from "zod";

import { confirmCustomerEmail } from "@/lib/customer-accounts/enrollment";
import { hashPassword } from "@/lib/security/password";

const verificationInput = z
  .object({
    password: z.string().min(12).max(256),
    passwordConfirmation: z.string().min(12).max(256),
    token: z.string().min(32).max(256)
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"]
  });

export type CustomerEmailVerificationState = {
  error?: string;
  success?: boolean;
};

export async function verifyCustomerEmail(
  _previousState: CustomerEmailVerificationState,
  formData: FormData
): Promise<CustomerEmailVerificationState> {
  const parsed = verificationInput.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    token: formData.get("token")
  });
  if (!parsed.success) {
    return { error: "Usa una contraseña de al menos 12 caracteres y confírmala." };
  }

  const confirmed = await confirmCustomerEmail(
    parsed.data.token,
    await hashPassword(parsed.data.password)
  );
  return confirmed
    ? { success: true }
    : { error: "Este enlace ya no es válido. Solicita una nueva verificación." };
}
