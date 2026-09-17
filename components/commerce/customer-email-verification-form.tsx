"use client";

import { useActionState } from "react";

import {
  verifyCustomerEmail,
  type CustomerEmailVerificationState
} from "@/app/suministro/registro/verificar/actions";

import styles from "./customer-email-verification-form.module.css";

export function CustomerEmailVerificationForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<CustomerEmailVerificationState, FormData>(
    verifyCustomerEmail,
    {}
  );

  if (state.success) {
    return (
      <section aria-live="polite" className={styles.success}>
        <p>CORREO CONFIRMADO</p>
        <h2>Tu perfil está en revisión.</h2>
        <span>
          Te avisaremos cuando JANVIER active tu cuenta comercial y puedas consultar tus
          precios y cotizaciones.
        </span>
      </section>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <input name="token" type="hidden" value={token} />
      <label>
        <span>CREA TU CONTRASEÑA</span>
        <input autoComplete="new-password" name="password" required type="password" />
      </label>
      <label>
        <span>CONFIRMA TU CONTRASEÑA</span>
        <input autoComplete="new-password" name="passwordConfirmation" required type="password" />
      </label>
      <p>USA AL MENOS 12 CARACTERES.</p>
      <button disabled={isPending} type="submit">
        {isPending ? "CONFIRMANDO…" : "CONFIRMAR CORREO"}
        <span aria-hidden="true">→</span>
      </button>
      <em aria-live="polite">{state.error}</em>
    </form>
  );
}
