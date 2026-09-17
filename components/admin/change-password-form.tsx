"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  changeCurrentAdminPassword,
  type PasswordChangeState
} from "@/app/(admin)/admin/seguridad/actions";

import styles from "./change-password-form.module.css";

const initialState: PasswordChangeState = {};

export function ChangePasswordForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    changeCurrentAdminPassword,
    initialState
  );

  useEffect(() => {
    if (!state.success) return;
    const timeout = window.setTimeout(() => router.replace("/admin/acceso"), 1300);
    return () => window.clearTimeout(timeout);
  }, [router, state.success]);

  return (
    <form action={formAction} className={styles.form}>
      <label>
        <span>CONTRASEÑA ACTUAL</span>
        <input
          autoComplete="current-password"
          name="currentPassword"
          required
          type="password"
        />
      </label>
      <label>
        <span>NUEVA CONTRASEÑA</span>
        <input
          autoComplete="new-password"
          minLength={12}
          name="newPassword"
          required
          type="password"
        />
      </label>
      <label>
        <span>CONFIRMAR NUEVA CONTRASEÑA</span>
        <input
          autoComplete="new-password"
          minLength={12}
          name="confirmation"
          required
          type="password"
        />
      </label>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      <button disabled={isPending} type="submit">
        {isPending ? "Actualizando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}
