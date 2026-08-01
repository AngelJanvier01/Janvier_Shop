"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./login-form.module.css";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
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

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("No fue posible conectar con el acceso administrativo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        <span>CORREO</span>
        <input autoComplete="username" name="email" required type="email" />
      </label>
      <label>
        <span>CONTRASEÑA</span>
        <input autoComplete="current-password" name="password" required type="password" />
      </label>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Verificando…" : "Entrar al sistema"}
      </button>
      <p aria-live="polite" className={styles.error}>
        {error}
      </p>
    </form>
  );
}
