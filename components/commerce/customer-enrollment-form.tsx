"use client";

import { FormEvent, useState } from "react";

import styles from "./customer-enrollment-form.module.css";

const purchaseVolumeOptions = [
  { value: "PERSONAL", label: "Compra individual" },
  { value: "OCCASIONAL", label: "Compras ocasionales" },
  { value: "REGULAR", label: "Compra recurrente" },
  { value: "PROJECTS", label: "Proyectos y licitaciones" },
  { value: "ENTERPRISE", label: "Abastecimiento empresarial" }
] as const;

export function CustomerEnrollmentForm() {
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/customer-enrollment", {
        body: JSON.stringify({
          companyName: data.get("companyName"),
          contactName: data.get("contactName"),
          contactPhone: data.get("contactPhone"),
          contactRole: data.get("contactRole"),
          email: data.get("email"),
          purchaseIntent: data.get("purchaseIntent"),
          purchaseVolume: data.get("purchaseVolume"),
          taxId: data.get("taxId"),
          termsAccepted: data.get("termsAccepted") === "on"
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "No fue posible registrar tu solicitud.");
        return;
      }

      setIsSubmitted(true);
      form.reset();
    } catch {
      setError("No fue posible conectar con el registro comercial.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <section aria-live="polite" className={styles.confirmation}>
        <p>VERIFICACIÓN ENVIADA</p>
        <h2>Revisa tu correo.</h2>
        <span>
          Cuando confirmes tu dirección, revisaremos tu perfil comercial antes de activar
          el acceso a la plataforma.
        </span>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.fieldGrid}>
        <label>
          <span>NOMBRE COMPLETO</span>
          <input
            autoComplete="name"
            data-copy-allowed
            name="contactName"
            required
            type="text"
          />
        </label>
        <label>
          <span>CORREO CORPORATIVO</span>
          <input
            autoComplete="email"
            data-copy-allowed
            name="email"
            required
            type="email"
          />
        </label>
        <label>
          <span>TELÉFONO</span>
          <input
            autoComplete="tel"
            data-copy-allowed
            name="contactPhone"
            required
            type="tel"
          />
        </label>
        <label>
          <span>EMPRESA</span>
          <input
            autoComplete="organization"
            data-copy-allowed
            name="companyName"
            required
            type="text"
          />
        </label>
        <label>
          <span>RFC</span>
          <input
            autoCapitalize="characters"
            data-copy-allowed
            name="taxId"
            pattern="[A-Za-z&Ññ]{3,4}[0-9]{6}[A-Za-z0-9]{3}"
            required
            type="text"
          />
        </label>
        <label>
          <span>CARGO</span>
          <input
            autoComplete="organization-title"
            data-copy-allowed
            name="contactRole"
            required
            type="text"
          />
        </label>
      </div>
      <label>
        <span>VOLUMEN DE COMPRA ESTIMADO</span>
        <select defaultValue="" name="purchaseVolume" required>
          <option disabled value="">
            Selecciona una opción
          </option>
          {purchaseVolumeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>CUÉNTANOS QUÉ BUSCAS</span>
        <textarea data-copy-allowed name="purchaseIntent" rows={4} />
      </label>
      <label className={styles.consent}>
        <input name="termsAccepted" required type="checkbox" />
        <span>ACEPTO EL AVISO DE PRIVACIDAD Y LOS TÉRMINOS COMERCIALES.</span>
      </label>
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "ENVIANDO SOLICITUD…" : "SOLICITAR ACCESO"}
        <span aria-hidden="true">→</span>
      </button>
      <p aria-live="polite" className={styles.error}>
        {error}
      </p>
    </form>
  );
}
