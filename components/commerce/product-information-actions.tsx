"use client";

import { type FormEvent, useState } from "react";

import { sendProductEngagement } from "@/components/analytics/product-engagement-client";

import styles from "./product-information-actions.module.css";

type ProductInformationActionsProps = {
  defaultEmail?: string;
  emailAvailable: boolean;
  productId: string;
  productName: string;
  slug: string;
};

type RequestState = "idle" | "sending" | "sent" | "error";

export function ProductInformationActions({
  defaultEmail = "",
  emailAvailable,
  productId,
  productName,
  slug
}: ProductInformationActionsProps) {
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState(
    emailAvailable
      ? ""
      : "El envío por correo está en configuración. Por ahora puedes descargar el PDF."
  );

  async function sendProductInformation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailAvailable) return;
    const form = event.currentTarget;
    const email = new FormData(form).get("email");
    setRequestState("sending");
    setMessage("");

    try {
      const response = await fetch(
        `/api/catalog/products/${encodeURIComponent(slug)}/email`,
        {
          body: JSON.stringify({ email }),
          headers: { "content-type": "application/json" },
          method: "POST"
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        setRequestState("error");
        setMessage(payload?.error ?? "No pudimos preparar el correo. Intenta de nuevo.");
        return;
      }
      setRequestState("sent");
      setMessage(
        payload?.message ?? "Listo. La ficha quedó preparada para enviarse a tu correo."
      );
    } catch {
      setRequestState("error");
      setMessage("No pudimos conectar con el servicio de correo. Intenta de nuevo.");
    }
  }

  return (
    <section
      className={styles.actions}
      aria-label={`Compartir información de ${productName}`}
    >
      <div className={styles.actionGrid}>
        <a
          className={styles.download}
          download
          href={`/api/catalog/products/${encodeURIComponent(slug)}/pdf`}
          onClick={() =>
            sendProductEngagement({ eventType: "TECHNICAL_SHEET_VIEW", productId })
          }
        >
          <span>DESCARGAR PDF</span>
          <small>FICHA TÉCNICA LISTA PARA COMPARTIR</small>
        </a>
        <div className={styles.emailHeading}>
          <span>ENVIAR POR CORREO</span>
          <small>RECIBE ESTA FICHA Y CONOCE MÁS DE JANVIER</small>
        </div>
      </div>
      <form className={styles.emailForm} onSubmit={sendProductInformation}>
        <label>
          <span>CORREO ELECTRÓNICO</span>
          <input
            autoComplete="email"
            defaultValue={defaultEmail}
            disabled={!emailAvailable || requestState === "sending"}
            inputMode="email"
            maxLength={320}
            name="email"
            placeholder="nombre@empresa.com"
            required
            type="email"
          />
        </label>
        <button disabled={!emailAvailable || requestState === "sending"} type="submit">
          {!emailAvailable
            ? "CORREO EN CONFIGURACIÓN"
            : requestState === "sending"
              ? "PREPARANDO…"
              : "ENVIAR FICHA"}
        </button>
      </form>
      <p className={styles.guestNote}>
        No necesitas iniciar sesión. Te enviaremos esta ficha y una breve presentación de
        JANVIER; no usamos tu correo para crear una cuenta automáticamente.
      </p>
      <p
        aria-live="polite"
        className={
          requestState === "error" || !emailAvailable ? styles.error : styles.message
        }
      >
        {message}
      </p>
    </section>
  );
}
