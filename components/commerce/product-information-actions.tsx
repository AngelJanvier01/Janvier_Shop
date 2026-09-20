"use client";

import Link from "next/link";
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

type ActionKind = "email" | "documentation";
type RequestState = "error" | "idle" | "login" | "sending" | "sent";

const actionCopy: Record<
  ActionKind,
  { action: string; description: string; title: string }
> = {
  documentation: {
    action: "SOLICITAR INFORMACIÓN",
    description: "MANUALES, DIAGRAMAS O CERTIFICADOS",
    title: "SOLICITAR MANUALES / DIAGRAMAS / CERTIFICADOS"
  },
  email: {
    action: "ENVIAR FICHA",
    description: "RECÍBELA EN TU CORREO",
    title: "ENVIAR POR CORREO"
  }
};

export function ProductInformationActions({
  defaultEmail = "",
  emailAvailable,
  productId,
  productName,
  slug
}: ProductInformationActionsProps) {
  const [action, setAction] = useState<ActionKind>("email");
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [showBenefits, setShowBenefits] = useState(false);
  const copy = actionCopy[action];

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action === "email" && !emailAvailable) {
      setRequestState("error");
      setMessage("El envío por correo estará disponible muy pronto.");
      return;
    }

    setRequestState("sending");
    setMessage("");
    try {
      const accountCheck = await fetch(
        `/api/catalog/products/${encodeURIComponent(slug)}/access-check`,
        {
          body: JSON.stringify({ email }),
          headers: { "content-type": "application/json" },
          method: "POST"
        }
      );
      const accountPayload = (await accountCheck.json().catch(() => null)) as {
        error?: string;
        status?: "GUEST" | "LOGIN_REQUIRED" | "SIGNED_IN";
      } | null;
      if (!accountCheck.ok) {
        setRequestState("error");
        setMessage(
          accountPayload?.error ?? "No pudimos validar tu correo. Intenta de nuevo."
        );
        return;
      }
      if (accountPayload?.status === "LOGIN_REQUIRED") {
        setRequestState("login");
        setMessage("Ya tienes una cuenta JANVIER. Inicia sesión para continuar.");
        return;
      }

      const endpoint =
        action === "email"
          ? `/api/catalog/products/${encodeURIComponent(slug)}/email`
          : `/api/catalog/products/${encodeURIComponent(slug)}/documentation-request`;
      const response = await fetch(endpoint, {
        body: JSON.stringify({ email }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as {
        code?: "LOGIN_REQUIRED";
        error?: string;
        message?: string;
      } | null;
      if (payload?.code === "LOGIN_REQUIRED") {
        setRequestState("login");
        setMessage("Ya tienes una cuenta JANVIER. Inicia sesión para continuar.");
        return;
      }
      if (!response.ok) {
        setRequestState("error");
        setMessage(
          payload?.error ?? "No pudimos registrar tu solicitud. Intenta de nuevo."
        );
        return;
      }
      if (action === "email") {
        sendProductEngagement({ eventType: "TECHNICAL_SHEET_VIEW", productId });
      }
      setRequestState("sent");
      setMessage(
        payload?.message ?? "Listo. Recibimos tu solicitud y te mantendremos informado."
      );
      setShowBenefits(true);
    } catch {
      setRequestState("error");
      setMessage("No pudimos conectar en este momento. Intenta de nuevo.");
    }
  }

  return (
    <section className={styles.actions} aria-label={`Información de ${productName}`}>
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
          <small>FICHA TÉCNICA PARA COMPARTIR</small>
        </a>
        {(Object.keys(actionCopy) as ActionKind[]).map((kind) => (
          <button
            aria-pressed={action === kind}
            className={styles.actionChoice}
            data-active={action === kind}
            key={kind}
            onClick={() => {
              setAction(kind);
              setMessage("");
              setRequestState("idle");
            }}
            type="button"
          >
            <span>{actionCopy[kind].title}</span>
            <small>{actionCopy[kind].description}</small>
          </button>
        ))}
      </div>

      <form className={styles.emailForm} onSubmit={submitRequest}>
        <label>
          <span>CORREO ELECTRÓNICO</span>
          <input
            autoComplete="email"
            disabled={requestState === "sending"}
            inputMode="email"
            maxLength={320}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@empresa.com"
            required
            type="email"
            value={email}
          />
        </label>
        <button disabled={requestState === "sending"} type="submit">
          {requestState === "sending" ? "PREPARANDO…" : copy.action}
        </button>
      </form>
      <p className={styles.guestNote}>
        Si ya tienes cuenta, te pediremos iniciar sesión para mantener tus solicitudes y
        beneficios en un mismo lugar.
      </p>
      {requestState === "login" ? (
        <Link
          className={styles.loginLink}
          href={`/suministro/acceso?email=${encodeURIComponent(email)}&next=${encodeURIComponent(
            `/suministro/catalogo/${slug}`
          )}`}
        >
          INICIAR SESIÓN
        </Link>
      ) : null}
      <p
        aria-live="polite"
        className={requestState === "error" ? styles.error : styles.message}
      >
        {message}
      </p>

      {showBenefits ? (
        <div aria-modal="true" className={styles.benefitBackdrop} role="dialog">
          <section
            aria-labelledby="account-benefits-title"
            className={styles.benefitDialog}
          >
            <button
              aria-label="Cerrar"
              className={styles.closeDialog}
              onClick={() => setShowBenefits(false)}
              type="button"
            >
              ×
            </button>
            <p>UNA CUENTA JANVIER TE ACOMPAÑA</p>
            <h2 id="account-benefits-title">
              Guarda tus productos y consulta tus solicitudes.
            </h2>
            <span>
              Al solicitar una cuenta podrás conservar tu carrito, consultar condiciones
              comerciales y dar seguimiento a cotizaciones desde un solo lugar.
            </span>
            <div>
              <Link href="/suministro/registro">SOLICITAR UNA CUENTA</Link>
              <button onClick={() => setShowBenefits(false)} type="button">
                SEGUIR EXPLORANDO
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
