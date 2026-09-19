"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./customer-login-form.module.css";

export function CustomerLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/customer/auth/login", {
        body: JSON.stringify({
          email: fields.get("email"),
          password: fields.get("password")
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "No fue posible iniciar sesión.");
        return;
      }
      router.replace("/suministro/catalogo");
      router.refresh();
    } catch {
      setError("No fue posible conectar con tu cuenta comercial.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        <span>CORREO</span>
        <input
          autoComplete="username"
          data-copy-allowed
          name="email"
          required
          type="email"
        />
      </label>
      <label>
        <span>CONTRASEÑA</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "VERIFICANDO…" : "ENTRAR A MI CUENTA"}
        <span aria-hidden="true">→</span>
      </button>
      <p aria-live="polite">{error}</p>
    </form>
  );
}
