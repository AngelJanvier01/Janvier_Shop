"use client";

import { useState } from "react";

type Props = {
  bootstrapConfigured: boolean;
  configurationVersion: number | null;
  connected: boolean;
  deliveryEnabled: boolean;
  mailEnabled: boolean;
};

export function EmailDeliveryActions({
  bootstrapConfigured,
  configurationVersion,
  connected,
  deliveryEnabled,
  mailEnabled
}: Props) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function post(path: string, body?: unknown) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { "content-type": "application/json" } : undefined,
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage(
        payload?.error ??
          (response.ok
            ? "Acción registrada. Recarga para ver el estado actualizado."
            : "No fue posible completar la acción.")
      );
    } catch {
      setMessage("No fue posible completar la acción.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="emailDeliveryActions">
        {connected ? (
          <>
            <button
              disabled={pending}
              onClick={() => post("/api/admin/settings/email/google/check")}
              type="button"
            >
              COMPROBAR CONEXIÓN
            </button>
            {bootstrapConfigured ? (
              <a href="/api/admin/settings/email/google/start?return=/admin/ajustes/correo">
                RECONECTAR
              </a>
            ) : null}
            <button
              disabled={pending}
              onClick={() => {
                const currentPassword = window.prompt(
                  "Confirma tu contraseña administrativa actual:"
                );
                if (!currentPassword || configurationVersion === null) return;
                void post("/api/admin/settings/email/google/disconnect", {
                  configurationVersion,
                  confirmation: "DESCONECTAR",
                  currentPassword
                });
              }}
              type="button"
            >
              DESCONECTAR
            </button>
            <button
              disabled={pending || !mailEnabled}
              onClick={() => {
                const recipient = window.prompt(
                  "Destinatario autorizado para la prueba:"
                );
                if (!recipient) return;
                void post("/api/admin/settings/email/google/test", { recipient });
              }}
              type="button"
            >
              ENCOLAR PRUEBA
            </button>
            <button
              disabled={pending || !mailEnabled}
              onClick={() =>
                configurationVersion !== null &&
                post("/api/admin/settings/email/delivery", {
                  configurationVersion,
                  deliveryEnabled: !deliveryEnabled
                })
              }
              type="button"
            >
              {deliveryEnabled ? "PAUSAR ENTREGA" : "HABILITAR ENTREGA"}
            </button>
          </>
        ) : bootstrapConfigured ? (
          <a href="/api/admin/settings/email/google/start?return=/admin/ajustes/correo">
            CONECTAR CON GOOGLE
          </a>
        ) : (
          <button disabled type="button">
            CONFIGURACIÃ“N DE GOOGLE REQUERIDA
          </button>
        )}
      </div>
      <p aria-live="polite" className="emailDeliveryActionMessage">
        {message}
      </p>
    </div>
  );
}
