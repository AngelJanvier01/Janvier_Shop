"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./customer-login-form.module.css";

export function CustomerLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const rememberEmailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem("janvier_customer_email");
    if (!rememberedEmail) return;
    if (emailRef.current) emailRef.current.value = rememberedEmail;
    if (rememberEmailRef.current) rememberEmailRef.current.checked = true;
  }, []);

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
      const email = String(fields.get("email") ?? "").trim();
      if (fields.get("rememberEmail")) {
        window.localStorage.setItem("janvier_customer_email", email);
      } else {
        window.localStorage.removeItem("janvier_customer_email");
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
          ref={emailRef}
          required
          type="email"
        />
      </label>
      <label className={styles.remember}>
        <input name="rememberEmail" ref={rememberEmailRef} type="checkbox" />
        <span>RECORDAR MI CORREO EN ESTE DISPOSITIVO</span>
      </label>
      <small>
        Tu navegador puede guardar la contraseña de forma segura. La sesión se cerrará
        después de 60 minutos sin actividad.
      </small>
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
