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
  const deliveryReady = state.mailEnabled && state.legacySmtpAvailable;
  return (
    <section className={styles.page}>
      <nav aria-label="Secciones de ajustes" className={styles.settingsNav}>
        <Link href="/admin/ajustes/sucursales">SUCURSALES</Link>
        <Link aria-current="page" href="/admin/ajustes/correo">
          CORREO Y NOTIFICACIONES
        </Link>
        <Link href="/admin/ajustes/pagos">PAGOS Y SPEI</Link>
      </nav>
      <p>AJUSTES / CORREO</p>
      <h1>Correo y notificaciones.</h1>
      <p className={styles.intro}>
        Comprueba en un vistazo si el correo está listo y envía una prueba. La opción más
        sencilla es Gmail con contraseña de aplicación; OAuth queda disponible como método
        avanzado.
      </p>

      <section className={styles.statusOverview} data-ready={deliveryReady}>
        <div>
          <span>ESTADO GENERAL</span>
          <strong>
            {deliveryReady ? "LISTO PARA ENVIAR" : "CONFIGURACIÓN PENDIENTE"}
          </strong>
        </div>
        <dl>
          <div>
            <dt>Servidor habilitado</dt>
            <dd>{state.mailEnabled ? "SÍ" : "NO"}</dd>
          </div>
          <div>
            <dt>SMTP configurado</dt>
            <dd>{state.legacySmtpAvailable ? "SÍ" : "NO"}</dd>
          </div>
          <div>
            <dt>Último envío</dt>
            <dd>{date(configuration?.lastSuccessfulSendAt ?? null)}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.grid}>
        <article className={`${styles.card} ${styles.controlCard}`}>
          <p>ACCIONES PRINCIPALES</p>
          <h2>Comprobar y probar.</h2>
          <p className={styles.cardCopy}>
            Primero comprueba la conexión. Después envía un correo de prueba antes de
            habilitar registros o notificaciones reales.
          </p>
          <div className={styles.actions}>
            <EmailDeliveryActions
              bootstrapConfigured={state.bootstrap.configured}
              configurationVersion={configuration?.configurationVersion ?? null}
              connected={configuration?.providerStatus === "CONNECTED"}
              deliveryEnabled={configuration?.deliveryEnabled ?? false}
              mailEnabled={state.mailEnabled}
              smtpAvailable={state.legacySmtpAvailable}
            />
          </div>
          {!state.mailEnabled ? (
            <p className={styles.warning}>
              El envío está apagado en el servidor. Configura{" "}
              <code>MAIL_ENABLED=true</code> y reinicia el servicio.
            </p>
          ) : null}
        </article>

        <article className={`${styles.card} ${styles.recommended}`}>
          <p>RECOMENDADO / CONTRASEÑA DE APLICACIÓN</p>
          <h2>SMTP de Gmail.</h2>
          <p className={styles.cardCopy}>
            Sólo necesitas una cuenta de Gmail con verificación en dos pasos y una
            contraseña de aplicación. Los valores se leen del servidor y nunca se muestran
            completos aquí.
          </p>
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
          {!state.legacySmtpAvailable ? (
            <ol>
              <li>Activa la verificación en dos pasos de la cuenta de Google.</li>
              <li>Genera una contraseña de aplicación para correo.</li>
              <li>Completa las variables SMTP en el servidor.</li>
              <li>Reinicia el servicio y usa “Comprobar SMTP”.</li>
            </ol>
          ) : (
            <p className={styles.readyMessage}>
              La configuración SMTP está completa. Usa las acciones superiores para
              comprobarla y enviar una prueba.
            </p>
          )}
          <p className={styles.envList}>
            MAIL_ENABLED · SMTP_HOST · SMTP_PORT · SMTP_SECURE · SMTP_USER ·
            SMTP_APP_PASSWORD · MAIL_FROM · MAIL_REPLY_TO · ALERT_RECIPIENTS · APP_URL
          </p>
        </article>

        <article className={styles.card}>
          <p>DETALLE OPERATIVO</p>
          <h2>Última actividad.</h2>
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
              <dt>Interruptor general</dt>
              <dd>{state.mailEnabled ? "HABILITADO" : "DESHABILITADO"}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>{configuration?.deliveryEnabled ? "HABILITADA" : "PAUSADA"}</dd>
            </div>
          </dl>
        </article>
      </div>

      <details className={styles.advanced}>
        <summary>
          <span>
            <strong>CONFIGURACIÓN AVANZADA / GMAIL API</strong>
            <small>Abre esta sección sólo si prefieres OAuth en lugar de SMTP.</small>
          </span>
          <b>ABRIR +</b>
        </summary>
        <div className={styles.advancedBody}>
          <dl>
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
              <dt>Cuenta permitida</dt>
              <dd>{state.bootstrap.allowedAccount ?? "SIN RESTRICCIÓN"}</dd>
            </div>
          </dl>
          <ol>
            <li>Crea un proyecto en Google Cloud y habilita Gmail API.</li>
            <li>Configura la pantalla de consentimiento.</li>
            <li>Crea un cliente OAuth de tipo aplicación web.</li>
            <li>Copia la Redirect URI exacta y reinicia el servicio.</li>
          </ol>
          {state.bootstrap.publishingStatus === "testing" ? (
            <p className={styles.warning}>
              En modo testing, la autorización de Gmail puede caducar después de 7 días.
            </p>
          ) : null}
        </div>
      </details>
      <p className={styles.footer}>
        Las contraseñas y tokens permanecen en el servidor y nunca se muestran completos
        en esta interfaz.
      </p>
    </section>
  );
}
