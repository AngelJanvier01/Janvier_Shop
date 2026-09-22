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
  const [isBusiness, setIsBusiness] = useState(true);
  const [requiresInvoice, setRequiresInvoice] = useState(true);
  const [submissionResult, setSubmissionResult] = useState<
    "verification-queued" | "received" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [taxCertificate, setTaxCertificate] = useState<File | null>(null);
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
      const payload = new FormData();
      for (const [field, value] of Object.entries(values)) payload.append(field, value);
      payload.append("formOpenedAt", String(formOpenedAt.current ?? Date.now()));
      payload.append("isBusiness", String(isBusiness));
      payload.append("requiresInvoice", String(requiresInvoice));
      payload.append("termsAccepted", String(termsAccepted));
      payload.append("website", website);
      if (taxCertificate) payload.append("taxCertificate", taxCertificate);
      const response = await fetch("/api/customer-enrollment", {
        body: payload,
        method: "POST"
      });
      const responsePayload = (await response.json().catch(() => null)) as {
        error?: string;
        verificationQueued?: boolean;
      } | null;
      if (!response.ok) {
        const payload = responsePayload as {
          error?: string;
        } | null;
        setError(payload?.error ?? "No fue posible registrar tu solicitud.");
        return;
      }

      setSubmissionResult(
        responsePayload?.verificationQueued ? "verification-queued" : "received"
      );
    } catch {
      setError("No fue posible conectar con el registro comercial.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submissionResult) {
    return (
      <section aria-live="polite" className={styles.confirmation}>
        {submissionResult === "verification-queued" ? (
          <>
            <p>VERIFICACIÓN ENVIADA</p>
            <h2>Revisa tu correo.</h2>
            <span>
              Cuando confirmes tu dirección, revisaremos tu perfil comercial antes de
              activar el acceso a la plataforma.
            </span>
            <small>01 / CORREO, 02 / REVISIÓN, 03 / ACCESO.</small>
          </>
        ) : (
          <>
            <p>SOLICITUD RECIBIDA</p>
            <h2>Ya la tenemos.</h2>
            <span>
              Guardamos tu solicitud correctamente. Te contactaremos para confirmar el
              correo y continuar con la activación de tu cuenta.
            </span>
            <small>01 / SOLICITUD, 02 / CONTACTO, 03 / ACCESO.</small>
          </>
        )}
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
        <legend>02 / CUÉNTANOS SOBRE TU COMPRA.</legend>
        <p>Así podremos darte la atención y las condiciones adecuadas.</p>
        <label className={styles.individualChoice}>
          <input
            checked={!isBusiness}
            onChange={(event) => {
              setError("");
              const nextIsBusiness = !event.target.checked;
              setIsBusiness(nextIsBusiness);
              setRequiresInvoice(nextIsBusiness);
              setTaxCertificate(null);
              if (!nextIsBusiness) {
                setValues((current) => ({
                  ...current,
                  companyName: "",
                  contactRole: "",
                  taxId: ""
                }));
              }
            }}
            type="checkbox"
          />
          <span>NO SOY EMPRESA; COMPRO COMO PERSONA</span>
        </label>
        {!isBusiness ? (
          <label className={styles.invoiceChoice}>
            <input
              checked={requiresInvoice}
              onChange={(event) => {
                setError("");
                setRequiresInvoice(event.target.checked);
                if (!event.target.checked) {
                  setTaxCertificate(null);
                  updateField("taxId", "");
                }
              }}
              type="checkbox"
            />
            <span>
              <strong>NECESITO FACTURA FISCAL (CFDI)</strong>
              <small>
                Actívalo únicamente si necesitas factura; entonces te pediremos RFC y
                constancia fiscal.
              </small>
            </span>
          </label>
        ) : null}
        <div className={styles.fieldGrid}>
          <label>
            <span>EMPRESA</span>
            <input
              autoComplete="organization"
              data-copy-allowed
              disabled={!isBusiness}
              name="companyName"
              onChange={(event) => updateField("companyName", event.target.value)}
              required={isBusiness}
              type="text"
              value={values.companyName}
            />
          </label>
          <label>
            <span>{isBusiness ? "RFC" : "RFC PARA CFDI"}</span>
            <input
              autoCapitalize="characters"
              data-copy-allowed
              disabled={!isBusiness && !requiresInvoice}
              name="taxId"
              onChange={(event) => updateField("taxId", event.target.value.toUpperCase())}
              pattern="[A-Za-z&Ññ]{3,4}[0-9]{6}[A-Za-z0-9]{3}"
              required={isBusiness || requiresInvoice}
              type="text"
              value={values.taxId}
            />
          </label>
          <label>
            <span>CARGO</span>
            <input
              autoComplete="organization-title"
              data-copy-allowed
              disabled={!isBusiness}
              name="contactRole"
              onChange={(event) => updateField("contactRole", event.target.value)}
              required={isBusiness}
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
        <p>Agrega una nota breve para entender mejor lo que buscas.</p>
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
        {!isBusiness && requiresInvoice ? (
          <label className={styles.taxCertificate}>
            <span>CONSTANCIA DE SITUACIÓN FISCAL (CSF)</span>
            <input
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setTaxCertificate(event.target.files?.[0] ?? null)}
              required={requiresInvoice}
              type="file"
            />
            <small>
              Adjunta tu CSF en PDF, JPG o PNG. La resguardamos de forma privada para
              revisar tu solicitud.
            </small>
          </label>
        ) : null}
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
