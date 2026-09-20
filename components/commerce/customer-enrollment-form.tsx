"use client";

import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";

import styles from "./customer-enrollment-form.module.css";

const purchaseVolumeOptions = [
  { value: "PERSONAL", label: "Compra individual" },
  { value: "OCCASIONAL", label: "Compras ocasionales" },
  { value: "REGULAR", label: "Compra recurrente" },
  { value: "PROJECTS", label: "Proyectos y licitaciones" },
  { value: "ENTERPRISE", label: "Abastecimiento empresarial" }
] as const;

type EnrollmentField =
  | "companyName"
  | "contactName"
  | "contactPhone"
  | "contactRole"
  | "email"
  | "purchaseIntent"
  | "purchaseVolume"
  | "taxId";

const steps = ["CONTACTO", "EMPRESA", "SOLICITUD"] as const;

const initialValues: Record<EnrollmentField, string> = {
  companyName: "",
  contactName: "",
  contactPhone: "",
  contactRole: "",
  email: "",
  purchaseIntent: "",
  purchaseVolume: "",
  taxId: ""
};

export function CustomerEnrollmentForm() {
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [website, setWebsite] = useState("");
  const formOpenedAt = useRef<number | null>(null);

  useEffect(() => {
    formOpenedAt.current = Date.now();
  }, []);

  function updateField(field: EnrollmentField, value: string) {
    setError("");
    setValues((current) => ({ ...current, [field]: value }));
  }

  function showStep(nextStep: number) {
    setStep(Math.max(0, Math.min(nextStep, steps.length - 1)));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector(`.${styles.form}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }

  function moveToNextStep(event: MouseEvent<HTMLButtonElement>) {
    const fieldset = event.currentTarget.closest("fieldset");
    const controls = fieldset?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select"
    );
    const stepIsValid =
      controls && Array.from(controls).every((control) => control.reportValidity());
    if (!stepIsValid) return;
    showStep(step + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/customer-enrollment", {
        body: JSON.stringify({
          ...values,
          formOpenedAt: formOpenedAt.current ?? Date.now(),
          termsAccepted,
          website
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
        <small>01 / CORREO, 02 / REVISIÓN, 03 / ACCESO.</small>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label aria-hidden="true" className={styles.honeypot}>
        <span>SITIO WEB</span>
        <input
          autoComplete="off"
          name="website"
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          type="text"
          value={website}
        />
      </label>
      <div className={styles.progress} aria-label={`Paso ${step + 1} de ${steps.length}`}>
        {steps.map((label, index) => (
          <div data-active={index === step} data-complete={index < step} key={label}>
            <b>0{index + 1}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <fieldset className={styles.step} hidden={step !== 0}>
        <legend>01 / HABLEMOS DE TU OPERACIÓN.</legend>
        <p>
          Usaremos estos datos para validar tu cuenta y contactarte sobre la solicitud.
        </p>
        <div className={styles.fieldGrid}>
          <label>
            <span>NOMBRE COMPLETO</span>
            <input
              autoComplete="name"
              data-copy-allowed
              name="contactName"
              onChange={(event) => updateField("contactName", event.target.value)}
              required
              type="text"
              value={values.contactName}
            />
          </label>
          <label>
            <span>CORREO CORPORATIVO</span>
            <input
              autoComplete="email"
              data-copy-allowed
              name="email"
              onChange={(event) => updateField("email", event.target.value)}
              required
              type="email"
              value={values.email}
            />
          </label>
          <label>
            <span>TELÉFONO</span>
            <input
              autoComplete="tel"
              data-copy-allowed
              name="contactPhone"
              onChange={(event) => updateField("contactPhone", event.target.value)}
              required
              type="tel"
              value={values.contactPhone}
            />
          </label>
        </div>
        <div className={styles.actions}>
          <button onClick={moveToNextStep} type="button">
            CONTINUAR <span aria-hidden="true">→</span>
          </button>
        </div>
      </fieldset>

      <fieldset className={styles.step} hidden={step !== 1}>
        <legend>02 / DEFINAMOS TU PERFIL COMERCIAL.</legend>
        <p>Esto nos permite preparar la lista de precio y atención adecuadas.</p>
        <div className={styles.fieldGrid}>
          <label>
            <span>EMPRESA</span>
            <input
              autoComplete="organization"
              data-copy-allowed
              name="companyName"
              onChange={(event) => updateField("companyName", event.target.value)}
              required
              type="text"
              value={values.companyName}
            />
          </label>
          <label>
            <span>RFC</span>
            <input
              autoCapitalize="characters"
              data-copy-allowed
              name="taxId"
              onChange={(event) => updateField("taxId", event.target.value.toUpperCase())}
              pattern="[A-Za-z&Ññ]{3,4}[0-9]{6}[A-Za-z0-9]{3}"
              required
              type="text"
              value={values.taxId}
            />
          </label>
          <label>
            <span>CARGO</span>
            <input
              autoComplete="organization-title"
              data-copy-allowed
              name="contactRole"
              onChange={(event) => updateField("contactRole", event.target.value)}
              required
              type="text"
              value={values.contactRole}
            />
          </label>
          <label>
            <span>VOLUMEN DE COMPRA ESTIMADO</span>
            <select
              name="purchaseVolume"
              onChange={(event) => updateField("purchaseVolume", event.target.value)}
              required
              value={values.purchaseVolume}
            >
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
        </div>
        <div className={styles.actions}>
          <button
            className={styles.secondaryAction}
            onClick={() => showStep(0)}
            type="button"
          >
            ← VOLVER
          </button>
          <button onClick={moveToNextStep} type="button">
            CONTINUAR <span aria-hidden="true">→</span>
          </button>
        </div>
      </fieldset>

      <fieldset className={styles.step} hidden={step !== 2}>
        <legend>03 / CUÉNTANOS QUÉ NECESITAS.</legend>
        <p>Una nota breve ayuda a asignar tu solicitud a la persona correcta.</p>
        <label>
          <span>PROYECTO, EQUIPO O FRECUENCIA / OPCIONAL</span>
          <textarea
            data-copy-allowed
            name="purchaseIntent"
            onChange={(event) => updateField("purchaseIntent", event.target.value)}
            rows={4}
            value={values.purchaseIntent}
          />
        </label>
        <label className={styles.consent}>
          <input
            checked={termsAccepted}
            name="termsAccepted"
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
            type="checkbox"
          />
          <span>ACEPTO EL AVISO DE PRIVACIDAD Y LOS TÉRMINOS COMERCIALES.</span>
        </label>
        <div className={styles.actions}>
          <button
            className={styles.secondaryAction}
            onClick={() => showStep(1)}
            type="button"
          >
            ← VOLVER
          </button>
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "ENVIANDO SOLICITUD…" : "SOLICITAR ACCESO"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </fieldset>
      <p aria-live="polite" className={styles.error}>
        {error}
      </p>
    </form>
  );
}
