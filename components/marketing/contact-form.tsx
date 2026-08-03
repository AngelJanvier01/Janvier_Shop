"use client";

import { useActionState } from "react";

import { submitDiagnosticRequest } from "@/app/contacto/actions";

import styles from "./contact-form.module.css";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitDiagnosticRequest, {});

  return (
    <section className={styles.section} data-testid="contact-form-section" id="solicitud">
      <div className={styles.heading}>
        <p>DIAGNOSTIC_REQUEST / OPERATION_CONTEXT</p>
        <h2>Cuéntame qué necesita moverse.</h2>
        <p className={styles.intro}>
          Registramos este contexto de forma privada para llegar preparados a la primera
          conversación. Después puedes continuar directamente por WhatsApp.
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
            <span>NOMBRE / REQUIRED</span>
            <input autoComplete="name" name="contactName" required type="text" />
          </label>
          <label>
            <span>ORGANIZACIÓN</span>
            <input autoComplete="organization" name="companyName" type="text" />
          </label>
          <label>
            <span>CORREO / REQUIRED</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            <span>TELÉFONO</span>
            <input autoComplete="tel" name="phone" type="tel" />
          </label>
          <label>
            <span>ÁREA DE INTERÉS / REQUIRED</span>
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
            <span>HORIZONTE</span>
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
            <span>CONTEXTO / REQUIRED</span>
            <textarea
              name="message"
              placeholder="Qué está pasando, qué quieres lograr y qué restricciones importan."
              required
              rows={6}
            />
          </label>
        </div>

        <div className={styles.actions}>
          <button data-cursor-target disabled={isPending} type="submit">
            {isPending ? "Registrando solicitud…" : "Solicitar diagnóstico"}
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
            <a href={state.whatsappUrl} rel="noreferrer" target="_blank">
              Continuar por WhatsApp
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
