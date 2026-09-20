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
  return (
    <section className={styles.page}>
      <nav aria-label="Secciones de ajustes" className={styles.settingsNav}>
        <Link href="/admin/ajustes/sucursales">SUCURSALES</Link>
        <Link href="/admin/ajustes/correo">CORREO Y NOTIFICACIONES</Link>
        <Link aria-current="page" href="/admin/ajustes/pagos">
          PAGOS Y SPEI
        </Link>
      </nav>
      <p>AJUSTES / PAYMENT_CONTROL</p>
      <h1>Activa cobros sólo cuando todo esté listo.</h1>
      <p className={styles.intro}>
        La llave de Mercado Pago no se captura ni se guarda aquí: vive sólo en las
        variables del servidor. Este panel define el interruptor operativo, el descuento
        SPEI, vigencia, datos comerciales y las cuentas visibles dentro de cotizaciones
        definitivas.
      </p>

      <section className={styles.readiness}>
        <div>
          <span>MP PUBLIC KEY</span>
          <strong>{mercadoPago.publicKeyConfigured ? "CONFIGURADA" : "FALTANTE"}</strong>
        </div>
        <div>
          <span>MP ACCESS TOKEN</span>
          <strong>
            {mercadoPago.accessTokenConfigured ? "CONFIGURADO" : "FALTANTE"}
          </strong>
        </div>
        <div>
          <span>MP WEBHOOK SECRET</span>
          <strong>
            {mercadoPago.webhookSecretConfigured ? "CONFIGURADO" : "FALTANTE"}
          </strong>
        </div>
        <div>
          <span>CHECKOUT REAL</span>
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
            <label>
              <input
                defaultChecked={settings.paymentsEnabled}
                name="paymentsEnabled"
                type="checkbox"
              />{" "}
              <span>HABILITAR COBROS EN LA TIENDA</span>
            </label>
            <label>
              <input
                defaultChecked={settings.mercadoPagoEnabled}
                name="mercadoPagoEnabled"
                type="checkbox"
              />{" "}
              <span>OFRECER MERCADO PAGO</span>
            </label>
            <label>
              <input
                defaultChecked={settings.mercadoPagoSandbox}
                name="mercadoPagoSandbox"
                type="checkbox"
              />{" "}
              <span>MODO DE PRUEBA / SANDBOX</span>
            </label>
            <label>
              <input
                defaultChecked={settings.speiEnabled}
                name="speiEnabled"
                type="checkbox"
              />{" "}
              <span>OFRECER TRANSFERENCIA SPEI</span>
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
            <form
              action={updateSpeiBankAccount}
              className={styles.account}
              key={account.id}
            >
              <input name="accountId" type="hidden" value={account.id} />
              <div className={styles.accountHead}>
                <strong>{account.alias}</strong>
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
              <button type="submit">ACTUALIZAR CUENTA</button>
            </form>
          ))}
        </div>
        <form
          action={createSpeiBankAccount}
          className={`${styles.account} ${styles.newAccount}`}
        >
          <div className={styles.accountHead}>
            <strong>NUEVA CUENTA SPEI</strong>
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
      </section>
    </section>
  );
}
