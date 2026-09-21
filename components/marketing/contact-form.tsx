"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitDiagnosticRequest } from "@/app/contacto/actions";

import styles from "./contact-form.module.css";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitDiagnosticRequest, {});
  const trackedSuccess = useRef<string | null>(null);

  useEffect(() => {
    if (!state.success || trackedSuccess.current === state.success) return;
    trackedSuccess.current = state.success;
    const measurementWindow = window as typeof window & {
      dataLayer?: Array<Record<string, string>>;
    };
    measurementWindow.dataLayer?.push({
      event: "contact_form_submit",
      form_name: "diagnostic_request"
    });
  }, [state.success]);

  return (
    <section className={styles.section} data-testid="contact-form-section" id="solicitud">
      <div className={styles.heading}>
        <p>SOLICITUD / DATOS_DEL_PROYECTO</p>
        <h2>Cuéntame qué necesitas.</h2>
        <p className={styles.intro}>
          La información se guarda de forma privada y nos ayuda a revisar tu caso antes de
          responder. Después puedes continuar por WhatsApp.
        </p>
      </div>

      <form action={formAction} className={styles.form} data-testid="contact-form">
        <input
          aria-hidden="true"
          autoComplete="off"
          className={styles.honeypot}
          name="website"
          tabIndex={-1}
          type="text"
        />
        <div className={styles.grid}>
          <label>
            <span>NOMBRE / OBLIGATORIO</span>
            <input autoComplete="name" name="contactName" required type="text" />
          </label>
          <label>
            <span>ORGANIZACIÓN</span>
            <input autoComplete="organization" name="companyName" type="text" />
          </label>
          <label>
            <span>CORREO / OBLIGATORIO</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            <span>TELÉFONO</span>
            <input autoComplete="tel" name="phone" type="tel" />
          </label>
          <label>
            <span>ÁREA DE INTERÉS / OBLIGATORIO</span>
            <select defaultValue="" name="service" required>
              <option disabled value="">
                Selecciona una opción
              </option>
              <option value="Software y automatización">Software y automatización</option>
              <option value="Infraestructura y conectividad">
                Infraestructura y conectividad
              </option>
              <option value="Suministro tecnológico">Suministro tecnológico</option>
              <option value="Consultoría y diagnóstico">Consultoría y diagnóstico</option>
              <option value="Soporte y mantenimiento">Soporte y mantenimiento</option>
              <option value="Otra necesidad">Otra necesidad</option>
            </select>
          </label>
          <label>
            <span>¿PARA CUÁNDO LO NECESITAS?</span>
            <select defaultValue="" name="timeline">
              <option value="">Por definir</option>
              <option value="Necesito resolverlo pronto">
                Necesito resolverlo pronto
              </option>
              <option value="Este trimestre">Este trimestre</option>
              <option value="En los próximos 6 meses">En los próximos 6 meses</option>
              <option value="Estoy explorando opciones">Estoy explorando opciones</option>
            </select>
          </label>
          <label>
            <span>INVERSIÓN ESTIMADA</span>
            <select defaultValue="" name="budgetRange">
              <option value="">Prefiero conversarlo</option>
              <option value="Aún no lo defino">Aún no lo defino</option>
              <option value="Hasta $25,000 MXN">Hasta $25,000 MXN</option>
              <option value="$25,000 a $75,000 MXN">$25,000 a $75,000 MXN</option>
              <option value="$75,000 a $250,000 MXN">$75,000 a $250,000 MXN</option>
              <option value="Más de $250,000 MXN">Más de $250,000 MXN</option>
            </select>
          </label>
          <label className={styles.message}>
            <span>DETALLES / OBLIGATORIO</span>
            <textarea
              name="message"
              placeholder="Cuéntanos qué está pasando, qué quieres lograr y qué debemos considerar."
              required
              rows={6}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button
            data-analytics="DIAGNOSTIC_SUBMIT"
            data-cursor-target
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Enviando solicitud…" : "Enviar solicitud"}
          </button>
          <p
            aria-live="polite"
            className={state.error ? styles.error : styles.status}
            data-testid="contact-form-status"
            role={state.error ? "alert" : undefined}
          >
            {state.error ?? state.success ?? ""}
          </p>
          {state.whatsappUrl ? (
            <a
              data-analytics="DIAGNOSTIC_WHATSAPP"
              href={state.whatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              Continuar por WhatsApp
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
