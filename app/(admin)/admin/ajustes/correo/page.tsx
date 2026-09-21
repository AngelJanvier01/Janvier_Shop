import { AdminAuditEventType } from "@/app/generated/prisma/client";
import Link from "next/link";
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
      <nav aria-label="Secciones de ajustes" className={styles.settingsNav}>
        <Link href="/admin/ajustes/sucursales">SUCURSALES</Link>
        <Link aria-current="page" href="/admin/ajustes/correo">
          CORREO Y NOTIFICACIONES
        </Link>
      </nav>
      <p>AJUSTES / CORREO_Y_NOTIFICACIONES</p>
      <h1>Configura el envío de correos.</h1>
      <p className={styles.intro}>
        El método recomendado es SMTP con contraseña de aplicación: sencillo, revocable y
        sin guardar la contraseña en el navegador ni en la base de datos. Gmail API queda
        disponible como alternativa.
      </p>
      <div className={styles.grid}>
        <article className={`${styles.card} ${styles.recommended}`}>
          <p>RECOMENDADO / CONTRASEÑA DE APLICACIÓN</p>
          <h2>SMTP de Gmail.</h2>
          <dl>
            <div>
              <dt>Estado</dt>
              <dd>{state.legacySmtpAvailable ? "LISTO" : "FALTAN VARIABLES"}</dd>
            </div>
            <div>
              <dt>Servidor</dt>
              <dd>
                {state.smtp.host}:{state.smtp.port}
              </dd>
            </div>
            <div>
              <dt>Conexión segura</dt>
              <dd>{state.smtp.secure ? "SÍ / TLS" : "NO"}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>{state.smtp.user}</dd>
            </div>
            <div>
              <dt>Contraseña de aplicación</dt>
              <dd>{state.smtp.password}</dd>
            </div>
            <div>
              <dt>Remitente</dt>
              <dd>{state.smtp.from}</dd>
            </div>
            <div>
              <dt>APP_URL</dt>
              <dd>{state.smtp.appUrl}</dd>
            </div>
            <div>
              <dt>Destinatarios admin</dt>
              <dd>{state.smtp.recipients}</dd>
            </div>
          </dl>
          <ol>
            <li>Activa la verificación en dos pasos de la cuenta de Google.</li>
            <li>Genera una contraseña de aplicación para correo.</li>
            <li>
              Guárdala como <code>SMTP_APP_PASSWORD</code>; nunca uses la contraseña
              normal.
            </li>
            <li>
              Completa las variables SMTP del archivo <code>.env</code> y reinicia el
              servicio.
            </li>
          </ol>
          <p className={styles.envList}>
            MAIL_ENABLED · SMTP_HOST · SMTP_PORT · SMTP_SECURE · SMTP_USER ·
            SMTP_APP_PASSWORD · MAIL_FROM · MAIL_REPLY_TO · ALERT_RECIPIENTS · APP_URL
          </p>
        </article>
        <article className={styles.card}>
          <p>ALTERNATIVA / CONFIGURACIÓN DE GOOGLE CLOUD</p>
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
          ) : state.bootstrap.publishingStatus === "unknown" ? (
            <p className={styles.warning}>Estado de publicación de Google: UNKNOWN.</p>
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
              bootstrapConfigured={state.bootstrap.configured}
              configurationVersion={configuration?.configurationVersion ?? null}
              connected={configuration?.providerStatus === "CONNECTED"}
              deliveryEnabled={configuration?.deliveryEnabled ?? false}
              mailEnabled={state.mailEnabled}
              smtpAvailable={state.legacySmtpAvailable}
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
