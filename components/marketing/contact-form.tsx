"use client";

import { type FormEvent, useState } from "react";

import { createWhatsAppUrl } from "@/components/layout/navigation";

import styles from "./contact-form.module.css";

type ContactValues = {
  company: string;
  email: string;
  message: string;
  name: string;
  phone: string;
  service: string;
  timeline: string;
};

function readValue(values: FormData, field: keyof ContactValues) {
  const value = values.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function createContactWhatsAppUrl(values: ContactValues) {
  const lines = [
    "Hola, JANVIER.",
    "Quiero iniciar una conversación sobre una necesidad de mi operación.",
    "",
    `Nombre: ${values.name}`,
    `Organización: ${values.company || "No indicada"}`,
    `Correo: ${values.email}`,
    `Teléfono: ${values.phone || "No indicado"}`,
    `Área de interés: ${values.service}`,
    `Tiempo estimado: ${values.timeline || "Por definir"}`,
    "",
    "Contexto:",
    values.message
  ];
  return createWhatsAppUrl(lines.join("\n"));
}

export function ContactForm() {
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!form.reportValidity()) {
      setStatus("Revisa los campos marcados antes de continuar.");
      return;
    }

    const fields = new FormData(form);
    const values: ContactValues = {
      company: readValue(fields, "company"),
      email: readValue(fields, "email"),
      message: readValue(fields, "message"),
      name: readValue(fields, "name"),
      phone: readValue(fields, "phone"),
      service: readValue(fields, "service"),
      timeline: readValue(fields, "timeline")
    };
    const nextUrl = createContactWhatsAppUrl(values);

    setFallbackUrl(nextUrl);
    setStatus("Abrimos WhatsApp con tu resumen listo para enviar.");
    window.open(nextUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className={styles.section} data-testid="contact-form-section" id="solicitud">
      <div className={styles.heading}>
        <p>REQUEST / OPERATION_CONTEXT</p>
        <h2>Cuéntame qué necesita moverse.</h2>
        <p className={styles.intro}>
          Con este contexto llegamos a la primera conversación preparados. Al continuar,
          WhatsApp abrirá un resumen listo para enviar; aquí no guardamos tus datos.
        </p>
      </div>

      <form className={styles.form} data-testid="contact-form" onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <label>
            <span>NOMBRE / REQUIRED</span>
            <input autoComplete="name" name="name" required type="text" />
          </label>
          <label>
            <span>ORGANIZACIÓN</span>
            <input autoComplete="organization" name="company" type="text" />
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
          <button data-cursor-target type="submit">
            Preparar mensaje en WhatsApp
          </button>
          <p
            aria-live="polite"
            className={styles.status}
            data-testid="contact-form-status"
          >
            {status}
          </p>
          {fallbackUrl ? (
            <a href={fallbackUrl} rel="noreferrer" target="_blank">
              Abrir WhatsApp de nuevo
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
