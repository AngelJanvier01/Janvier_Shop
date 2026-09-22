import Link from "next/link";

import {
  createSpeiBankAccount,
  updatePaymentSettings,
  updateSpeiBankAccount
} from "../../pagos/actions";

import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { getMercadoPagoPublicConfiguration } from "@/lib/commerce/mercado-pago";
import { getPaymentConfigurationView } from "@/lib/commerce/payment-core";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Ajustes de pago"
};

export default async function PaymentSettingsPage() {
  const { admin } = await requireSettingsAdmin();
  const [configuration, accounts] = await Promise.all([
    database.commercePaymentConfiguration.findUnique({
      where: { installationKey: "default" }
    }),
    database.commerceSpeiBankAccount.findMany({
      orderBy: [{ priority: "asc" }, { alias: "asc" }]
    })
  ]);
  await database.adminAuditEvent.create({
    data: { type: "PAYMENT_SETTINGS_OPENED", userId: admin.id }
  });
  const settings = getPaymentConfigurationView(configuration);
  const mercadoPago = getMercadoPagoPublicConfiguration();
  const mercadoPagoCredentialsReady =
    mercadoPago.publicKeyConfigured &&
    mercadoPago.accessTokenConfigured &&
    mercadoPago.webhookSecretConfigured;
  const paymentState = !mercadoPagoCredentialsReady
    ? {
        label: "FALTAN CREDENCIALES",
        detail:
          "Agrega las tres credenciales de Mercado Pago en el servidor antes de habilitar cobros.",
        tone: "warning"
      }
    : !settings.paymentsEnabled
      ? {
          label: "COBROS DESACTIVADOS",
          detail:
            "Las credenciales están listas. Activa los cobros cuando termines la compra de prueba.",
          tone: "neutral"
        }
      : settings.mercadoPagoSandbox
        ? {
            label: "MODO DE PRUEBA ACTIVO",
            detail:
              "Puedes validar el checkout con usuarios y tarjetas de prueba sin realizar cobros reales.",
            tone: "testing"
          }
        : {
            label: "COBROS PRODUCTIVOS ACTIVOS",
            detail:
              "La tienda puede generar cobros reales. Revisa el webhook y una operación controlada.",
            tone: "ready"
          };
  return (
    <section className={styles.page}>
      <nav aria-label="Secciones de ajustes" className={styles.settingsNav}>
        <Link href="/admin/ajustes/sucursales">SUCURSALES</Link>
        <Link href="/admin/ajustes/correo">CORREO Y NOTIFICACIONES</Link>
        <Link aria-current="page" href="/admin/ajustes/pagos">
          PAGOS Y SPEI
        </Link>
      </nav>
      <p>AJUSTES / PAGOS</p>
      <h1>Pagos y transferencias.</h1>
      <p className={styles.intro}>
        Revisa primero el estado general, decide qué medios de pago mostrar y administra
        las cuentas SPEI. Las credenciales permanecen protegidas en el servidor.
      </p>

      <section className={styles.statusBanner} data-tone={paymentState.tone}>
        <div>
          <span>ESTADO ACTUAL</span>
          <strong>{paymentState.label}</strong>
        </div>
        <p>{paymentState.detail}</p>
      </section>

      <section className={styles.readiness}>
        <div>
          <span>CLAVE PÚBLICA</span>
          <strong>{mercadoPago.publicKeyConfigured ? "CONFIGURADA" : "FALTANTE"}</strong>
        </div>
        <div>
          <span>TOKEN DE ACCESO</span>
          <strong>
            {mercadoPago.accessTokenConfigured ? "CONFIGURADO" : "FALTANTE"}
          </strong>
        </div>
        <div>
          <span>FIRMA DEL WEBHOOK</span>
          <strong>
            {mercadoPago.webhookSecretConfigured ? "CONFIGURADO" : "FALTANTE"}
          </strong>
        </div>
        <div>
          <span>CHECKOUT</span>
          <strong>{mercadoPago.ready ? "PREPARADO" : "BLOQUEADO"}</strong>
        </div>
      </section>

      <section className={styles.section}>
        <header>
          <p>CONFIGURACIÓN CENTRAL</p>
          <h2>Reglas de cobro.</h2>
        </header>
        <form action={updatePaymentSettings} className={styles.settingsForm}>
          <fieldset className={styles.toggles}>
            <legend>MEDIOS DE PAGO VISIBLES</legend>
            <label>
              <input
                defaultChecked={settings.paymentsEnabled}
                name="paymentsEnabled"
                type="checkbox"
              />{" "}
              <span>
                <strong>HABILITAR COBROS EN LA TIENDA</strong>
                <small>Interruptor general. Si está apagado, ningún método cobra.</small>
              </span>
            </label>
            <label>
              <input
                defaultChecked={settings.mercadoPagoEnabled}
                name="mercadoPagoEnabled"
                type="checkbox"
              />{" "}
              <span>
                <strong>OFRECER MERCADO PAGO</strong>
                <small>Muestra tarjeta y los métodos disponibles en Mercado Pago.</small>
              </span>
            </label>
            <label>
              <input
                defaultChecked={settings.mercadoPagoSandbox}
                name="mercadoPagoSandbox"
                type="checkbox"
              />{" "}
              <span>
                <strong>MODO DE PRUEBA / SANDBOX</strong>
                <small>
                  Mantén esta opción activa hasta terminar una compra de prueba.
                </small>
              </span>
            </label>
            <label>
              <input
                defaultChecked={settings.speiEnabled}
                name="speiEnabled"
                type="checkbox"
              />{" "}
              <span>
                <strong>OFRECER TRANSFERENCIA SPEI</strong>
                <small>Genera una cotización con los datos bancarios activos.</small>
              </span>
            </label>
          </fieldset>
          <div className={styles.fields}>
            <label>
              <span>DESCUENTO SPEI / %</span>
              <input
                defaultValue={settings.speiDiscountPct}
                max="25"
                min="0"
                name="speiDiscountPct"
                step="0.01"
                type="number"
              />
            </label>
            <label>
              <span>VIGENCIA SPEI / HORAS</span>
              <input
                defaultValue={settings.speiQuoteExpirationHours}
                max="168"
                min="1"
                name="speiQuoteExpirationHours"
                type="number"
              />
            </label>
            <label>
              <span>NOMBRE COMERCIAL EMISOR</span>
              <input defaultValue={settings.sellerName} name="sellerName" required />
            </label>
            <label>
              <span>CONTACTO EN COTIZACIÓN</span>
              <input
                defaultValue={settings.sellerContact ?? ""}
                name="sellerContact"
                placeholder="ventas@jaanviieer.com"
              />
            </label>
            <label className={styles.wide}>
              <span>TÉRMINOS SPEI</span>
              <textarea
                defaultValue={settings.sellerTerms ?? ""}
                name="sellerTerms"
                placeholder="Vigencia, tiempos de verificación y condiciones de entrega…"
                rows={4}
              />
            </label>
          </div>
          <button type="submit">GUARDAR REGLAS DE PAGO</button>
        </form>
        <p className={styles.warning}>
          Aunque actives Mercado Pago aquí, el checkout permanece bloqueado hasta que las
          tres variables del servidor estén configuradas. El modo productivo se habilita
          al desmarcar sandbox después de probar cuentas y tarjetas de prueba.
        </p>
      </section>

      <section className={styles.section}>
        <header>
          <p>CUENTAS DE DESTINO</p>
          <h2>Transferencia SPEI.</h2>
        </header>
        <p className={styles.explanation}>
          Las cuentas sólo se muestran al cliente dentro de su cotización SPEI vigente. Al
          cambiar una cuenta, los documentos ya emitidos conservan su snapshot y nunca
          cambian. Desactiva una cuenta en vez de eliminarla para conservar auditoría.
        </p>
        <div className={styles.accounts}>
          {accounts.map((account) => (
            <details className={styles.accountPanel} key={account.id}>
              <summary>
                <span>
                  <strong>{account.alias}</strong>
                  <small>{account.bankName}</small>
                </span>
                <b data-active={account.isActive}>
                  {account.isActive ? "ACTIVA" : "INACTIVA"}
                </b>
              </summary>
              <form action={updateSpeiBankAccount} className={styles.account}>
                <input name="accountId" type="hidden" value={account.id} />
                <div className={styles.accountHead}>
                  <strong>EDITAR CUENTA</strong>
                  <label>
                    <input
                      defaultChecked={account.isActive}
                      name="isActive"
                      type="checkbox"
                    />{" "}
                    ACTIVA
                  </label>
                </div>
                <label>
                  <span>ALIAS</span>
                  <input defaultValue={account.alias} name="alias" required />
                </label>
                <label>
                  <span>BANCO</span>
                  <input defaultValue={account.bankName} name="bankName" required />
                </label>
                <label>
                  <span>BENEFICIARIO</span>
                  <input defaultValue={account.beneficiary} name="beneficiary" required />
                </label>
                <label>
                  <span>CLABE / 18 DÍGITOS</span>
                  <input
                    defaultValue={account.clabe ?? ""}
                    inputMode="numeric"
                    name="clabe"
                  />
                </label>
                <label>
                  <span>NÚMERO DE CUENTA</span>
                  <input
                    defaultValue={account.accountNumber ?? ""}
                    inputMode="numeric"
                    name="accountNumber"
                  />
                </label>
                <label>
                  <span>TIPO</span>
                  <input defaultValue={account.accountType} name="accountType" required />
                </label>
                <label>
                  <span>PRIORIDAD</span>
                  <input defaultValue={account.priority} name="priority" type="number" />
                </label>
                <input name="currency" type="hidden" value="MXN" />
                <button type="submit">GUARDAR CAMBIOS</button>
              </form>
            </details>
          ))}
        </div>
        <details className={`${styles.accountPanel} ${styles.newAccount}`}>
          <summary>
            <span>
              <strong>AGREGAR CUENTA SPEI</strong>
              <small>Banco, beneficiario y CLABE</small>
            </span>
            <b>ABRIR +</b>
          </summary>
          <form action={createSpeiBankAccount} className={styles.account}>
            <div className={styles.accountHead}>
              <strong>NUEVA CUENTA</strong>
              <label>
                <input defaultChecked name="isActive" type="checkbox" /> ACTIVA
              </label>
            </div>
            <label>
              <span>ALIAS</span>
              <input name="alias" placeholder="BANREGIO PRINCIPAL" required />
            </label>
            <label>
              <span>BANCO</span>
              <input name="bankName" required />
            </label>
            <label>
              <span>BENEFICIARIO</span>
              <input name="beneficiary" required />
            </label>
            <label>
              <span>CLABE / 18 DÍGITOS</span>
              <input inputMode="numeric" name="clabe" />
            </label>
            <label>
              <span>NÚMERO DE CUENTA</span>
              <input inputMode="numeric" name="accountNumber" />
            </label>
            <label>
              <span>TIPO</span>
              <input defaultValue="CUENTA" name="accountType" required />
            </label>
            <label>
              <span>PRIORIDAD</span>
              <input defaultValue="0" name="priority" type="number" />
            </label>
            <input name="currency" type="hidden" value="MXN" />
            <button type="submit">AGREGAR CUENTA</button>
          </form>
        </details>
      </section>
    </section>
  );
}
