import { AdminAuditEventType } from "@/app/generated/prisma/client";
import { EmailDeliveryActions } from "@/components/admin/email-delivery-actions";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { getDeliverySettingsView } from "@/lib/settings/delivery-settings";

import styles from "./page.module.css";

export const metadata = { robots: { index: false }, title: "Correo y notificaciones" };
export const dynamic = "force-dynamic";

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "—";
}

export default async function EmailSettingsPage() {
  const { admin } = await requireSettingsAdmin();
  const state = await getDeliverySettingsView();
  await database.adminAuditEvent.create({
    data: { type: AdminAuditEventType.EMAIL_SETTINGS_OPENED, userId: admin.id }
  });
  const configuration = state.configuration;
  return (
    <section className={styles.page}>
      <p>AJUSTES / CORREO_Y_NOTIFICACIONES</p>
      <h1>Entrega transaccional.</h1>
      <p className={styles.intro}>
        Google sólo recibirá el permiso <code>gmail.send</code>. JANVIER nunca solicita
        lectura de bandeja ni contraseñas de Google.
      </p>
      <div className={styles.grid}>
        <article className={styles.card}>
          <p>CONFIGURACIÓN DE GOOGLE CLOUD</p>
          <dl>
            <div>
              <dt>Gmail API</dt>
              <dd>CONFIGURACIÓN EXTERNA REQUERIDA</dd>
            </div>
            <div>
              <dt>OAuth Client ID</dt>
              <dd>{state.bootstrap.clientId}</dd>
            </div>
            <div>
              <dt>OAuth Client Secret</dt>
              <dd>{state.bootstrap.clientSecret}</dd>
            </div>
            <div>
              <dt>Encryption Key</dt>
              <dd>{state.bootstrap.encryptionKey}</dd>
            </div>
            <div>
              <dt>Redirect URI</dt>
              <dd className={styles.uri}>{state.bootstrap.redirectUri}</dd>
            </div>
            <div>
              <dt>Allowed account</dt>
              <dd>{state.bootstrap.allowedAccount ?? "SIN RESTRICCIÓN"}</dd>
            </div>
          </dl>
          <ol>
            <li>Crea o selecciona un proyecto en Google Cloud.</li>
            <li>Habilita Gmail API y configura la pantalla de consentimiento.</li>
            <li>Crea un cliente OAuth de tipo Web application.</li>
            <li>
              Copia esta Redirect URI exacta y guarda las variables sólo en el servidor.
            </li>
          </ol>
          {state.bootstrap.publishingStatus === "testing" ? (
            <p className={styles.warning}>
              Modo testing: la autorización de Gmail puede caducar después de 7 días.
            </p>
          ) : null}
        </article>
        <article className={styles.card}>
          <p>ESTADO PRINCIPAL</p>
          <dl>
            <div>
              <dt>Proveedor</dt>
              <dd>{configuration?.provider ?? "DISABLED"}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{configuration?.providerStatus ?? "NOT_CONFIGURED"}</dd>
            </div>
            <div>
              <dt>Cuenta</dt>
              <dd>{configuration?.account ?? "—"}</dd>
            </div>
            <div>
              <dt>Permiso</dt>
              <dd>
                {configuration?.grantedScopes.includes(
                  "https://www.googleapis.com/auth/gmail.send"
                )
                  ? "GMAIL.SEND"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Última conexión</dt>
              <dd>{date(configuration?.lastConnectedAt ?? null)}</dd>
            </div>
            <div>
              <dt>Última comprobación</dt>
              <dd>{date(configuration?.lastCheckedAt ?? null)}</dd>
            </div>
            <div>
              <dt>Último envío</dt>
              <dd>{date(configuration?.lastSuccessfulSendAt ?? null)}</dd>
            </div>
            <div>
              <dt>Kill switch</dt>
              <dd>
                {state.mailEnabled ? "ENABLED" : "SERVER DISABLED / MAIL_ENABLED=false"}
              </dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>{configuration?.deliveryEnabled ? "HABILITADA" : "PAUSADA"}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <EmailDeliveryActions
              configurationVersion={configuration?.configurationVersion ?? null}
              connected={configuration?.providerStatus === "CONNECTED"}
              deliveryEnabled={configuration?.deliveryEnabled ?? false}
              mailEnabled={state.mailEnabled}
            />
            <span>
              Las comprobaciones, reconexión, desconexión y pruebas se habilitan tras una
              conexión válida.
            </span>
          </div>
          {!state.mailEnabled ? (
            <p className={styles.warning}>
              BLOQUEADO POR CONFIGURACIÓN DEL SERVIDOR. Ninguna acción web puede omitir
              este interruptor.
            </p>
          ) : null}
        </article>
      </div>
      <p className={styles.footer}>
        Conectar abre Google en la misma pestaña. El refresh token queda cifrado en el
        servidor; nunca se muestra en esta interfaz.
      </p>
    </section>
  );
}
