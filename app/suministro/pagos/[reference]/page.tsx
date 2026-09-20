import Link from "next/link";
import { notFound } from "next/navigation";

import { MercadoPagoCardPayment } from "@/components/commerce/mercado-pago-card-payment";
import { PaymentCopyButton } from "@/components/commerce/payment-copy-button";
import { SpeiProofUpload } from "@/components/commerce/spei-proof-upload";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SupplySubheader } from "@/components/commerce/supply-subheader";
import { requireCurrentCustomer } from "@/lib/auth/current-customer";
import { getCartQuantity } from "@/lib/commerce/cart-quantity";
import { formatMxn } from "@/lib/commerce/catalog";
import { getMercadoPagoPublicConfiguration } from "@/lib/commerce/mercado-pago";
import {
  calculateSnapshotTotal,
  calculateSpeiTotals,
  getPaymentConfigurationView,
  isPaymentMethodAvailable,
  paymentStatusLabel
} from "@/lib/commerce/payment-core";
import { database } from "@/lib/database";

import { issueSpeiQuote, reportSpeiPayment } from "../../payment-actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Pago de pedido"
};

type PaymentPageProps = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ spei?: string }>;
};

const quoteStatusLabels: Record<string, string> = {
  AWAITING_PAYMENT: "EN ESPERA DE TRANSFERENCIA",
  CANCELLED: "CANCELADA",
  EXPIRED: "VENCIDA",
  ISSUED: "EMITIDA",
  PAYMENT_REPORTED: "TRANSFERENCIA REPORTADA",
  PAYMENT_VERIFIED: "PAGO CONFIRMADO",
  REFUNDED: "REEMBOLSADA"
};

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function bankSnapshot(value: unknown) {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const read = (key: string) => (typeof source[key] === "string" ? source[key] : null);
  return {
    accountNumber: read("accountNumber"),
    alias: read("alias") ?? "CUENTA SPEI",
    bankName: read("bankName") ?? "—",
    beneficiary: read("beneficiary") ?? "—",
    clabe: read("clabe")
  };
}

export default async function CustomerPaymentPage({
  params,
  searchParams
}: PaymentPageProps) {
  const [customer, route, query] = await Promise.all([
    requireCurrentCustomer(),
    params,
    searchParams
  ]);
  const [order, activeCart, configuration, bankAccounts] = await Promise.all([
    database.commerceOrder.findFirst({
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          select: { quantity: true, snapshotName: true, snapshotUnitPriceWithTax: true }
        },
        payments: {
          orderBy: { updatedAt: "desc" },
          select: { provider: true, status: true, updatedAt: true },
          take: 6
        },
        speiQuotes: {
          include: {
            payment: { select: { reviewNotes: true, status: true } },
            proofs: {
              select: { id: true, originalFileName: true },
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { issuedAt: "desc" },
          take: 8
        }
      },
      where: { accountId: customer.accountId, reference: route.reference }
    }),
    database.commerceCart.findFirst({
      select: { items: { select: { quantity: true } } },
      where: { accountId: customer.accountId, status: "ACTIVE" }
    }),
    database.commercePaymentConfiguration.findUnique({
      where: { installationKey: "default" }
    }),
    database.commerceSpeiBankAccount.findMany({
      orderBy: [{ priority: "asc" }, { alias: "asc" }],
      select: { alias: true, id: true },
      where: { currency: "MXN", isActive: true }
    })
  ]);
  if (!order) notFound();
  const settings = getPaymentConfigurationView(configuration);
  let total: number | null = null;
  try {
    total = calculateSnapshotTotal(order.items);
  } catch {
    total = null;
  }
  const speiTotals =
    total === null ? null : calculateSpeiTotals(total, settings.speiDiscountPct);
  const quote =
    order.speiQuotes.find((item) => item.reference === query.spei) ??
    order.speiQuotes[0] ??
    null;
  const quoteBank = quote ? bankSnapshot(quote.bankAccountSnapshot) : null;
  const mercadopago = getMercadoPagoPublicConfiguration();
  const paymentReady =
    order.status === "CONFIRMED" && order.paymentStatus !== "PAID" && total !== null;
  const speiAvailable =
    paymentReady && isPaymentMethodAvailable(settings, "SPEI") && bankAccounts.length > 0;
  const mercadoPagoAvailable =
    paymentReady &&
    isPaymentMethodAvailable(settings, "MERCADO_PAGO") &&
    mercadopago.ready &&
    Boolean(mercadopago.publicKey);

  return (
    <>
      <SiteHeader />
      <SupplySubheader
        cartItemCount={getCartQuantity(activeCart?.items)}
        companyName={customer.account.companyName}
        customerName={customer.name}
      />
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p>PAGO SEGURO JANVIER</p>
            <h1>Pago claro, pedido protegido.</h1>
            <span>
              {order.reference} · Tu importe se construye desde las partidas confirmadas,
              nunca desde el navegador.
            </span>
          </div>
          <Link href="/suministro/mi-cuenta">VOLVER A MI CUENTA</Link>
        </header>

        <section className={styles.orderState}>
          <div>
            <span>ESTADO OPERATIVO</span>
            <strong>
              {order.status === "CONFIRMED" ? "PEDIDO CONFIRMADO" : order.status}
            </strong>
          </div>
          <div>
            <span>ESTADO DE PAGO</span>
            <strong>{paymentStatusLabel(order.paymentStatus)}</strong>
          </div>
          <div>
            <span>IMPORTE C/IVA</span>
            <strong>{total === null ? "A VALIDAR" : formatMxn(total)}</strong>
          </div>
        </section>

        {!paymentReady ? (
          <section className={styles.blocked}>
            <p>CHECKOUT BLOQUEADO POR SEGURIDAD</p>
            <h2>
              {order.paymentStatus === "PAID"
                ? "Este pedido ya tiene un pago confirmado."
                : "Aún confirmamos existencia, entrega, vigencia o precio."}
            </h2>
            <span>
              Cuando operación confirme el pedido, aquí aparecerán las formas de pago
              disponibles.
            </span>
          </section>
        ) : (
          <section className={styles.methods}>
            <article className={styles.method} data-method="mercado-pago">
              <header>
                <p>TARJETA / MERCADO PAGO</p>
                <h2>Pago inmediato.</h2>
              </header>
              <dl>
                <div>
                  <dt>TOTAL</dt>
                  <dd>{formatMxn(total)}</dd>
                </div>
                <div>
                  <dt>CONFIRMACIÓN</dt>
                  <dd>VERIFICACIÓN SERVIDOR + WEBHOOK</dd>
                </div>
              </dl>
              {mercadoPagoAvailable ? (
                <MercadoPagoCardPayment
                  amount={total!}
                  customerEmail={customer.email}
                  orderReference={order.reference}
                  publicKey={mercadopago.publicKey!}
                />
              ) : (
                <p className={styles.unavailable}>
                  Mercado Pago se habilitará tras completar la configuración operativa de
                  la pasarela. No se realiza ningún cobro mientras tanto.
                </p>
              )}
            </article>

            <article className={styles.method} data-method="spei">
              <header>
                <p>TRANSFERENCIA DIRECTA / SPEI</p>
                <h2>Importe preferente.</h2>
              </header>
              <dl>
                <div>
                  <dt>PRECIO ORIGINAL</dt>
                  <dd>
                    {speiTotals ? formatMxn(speiTotals.totalBeforeDiscount) : "A VALIDAR"}
                  </dd>
                </div>
                <div>
                  <dt>AHORRO POR SPEI</dt>
                  <dd>{speiTotals ? `−${formatMxn(speiTotals.discountAmount)}` : "—"}</dd>
                </div>
                <div>
                  <dt>TOTAL SPEI</dt>
                  <dd>{speiTotals ? formatMxn(speiTotals.total) : "A VALIDAR"}</dd>
                </div>
              </dl>
              {quote ? (
                <section className={styles.speiDocument}>
                  <div className={styles.documentTopline}>
                    <p>COTIZACIÓN DEFINITIVA / {quoteStatusLabels[quote.status]}</p>
                    <a
                      href={`/api/commerce/spei-quotes/${encodeURIComponent(quote.reference)}/pdf`}
                    >
                      DESCARGAR PDF
                    </a>
                  </div>
                  <h3>{quote.reference}</h3>
                  <span>Vigencia: {dateTime(quote.expiresAt)}</span>
                  <div className={styles.transferData}>
                    <div>
                      <span>TOTAL EXACTO</span>
                      <strong>{formatMxn(Number(quote.total))}</strong>
                      <PaymentCopyButton
                        label="COPIAR TOTAL"
                        value={Number(quote.total).toFixed(2)}
                      />
                    </div>
                    <div>
                      <span>REFERENCIA / CONCEPTO</span>
                      <strong>{quote.reference}</strong>
                      <PaymentCopyButton
                        label="COPIAR REFERENCIA"
                        value={quote.reference}
                      />
                    </div>
                    <div>
                      <span>
                        {quoteBank?.bankName} / {quoteBank?.alias}
                      </span>
                      <strong>
                        {quoteBank?.clabe ?? quoteBank?.accountNumber ?? "—"}
                      </strong>
                      <PaymentCopyButton
                        label="COPIAR CLABE"
                        value={quoteBank?.clabe ?? quoteBank?.accountNumber ?? ""}
                      />
                    </div>
                  </div>
                  {quote.status === "AWAITING_PAYMENT" ? (
                    <div className={styles.reportActions}>
                      <form action={reportSpeiPayment}>
                        <input
                          name="quoteReference"
                          type="hidden"
                          value={quote.reference}
                        />
                        <button type="submit">YA REALICÉ LA TRANSFERENCIA</button>
                      </form>
                      <SpeiProofUpload quoteReference={quote.reference} />
                    </div>
                  ) : null}
                  {quote.status === "PAYMENT_REPORTED" ? (
                    <p className={styles.reviewNotice}>
                      RECIBIMOS TU AVISO. LA TRANSFERENCIA SIGUE PENDIENTE DE
                      CONCILIACIÓN; NO SE CONFIRMA AUTOMÁTICAMENTE.
                    </p>
                  ) : null}
                  {quote.payment?.reviewNotes ? (
                    <p className={styles.reviewNotice}>
                      OPERACIÓN: {quote.payment.reviewNotes}
                    </p>
                  ) : null}
                  {quote.proofs.length ? (
                    <ul className={styles.proofs}>
                      {quote.proofs.map((proof) => (
                        <li key={proof.id}>
                          <a
                            href={`/api/commerce/spei-proofs/${encodeURIComponent(proof.id)}`}
                          >
                            {proof.originalFileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : speiAvailable ? (
                <form action={issueSpeiQuote} className={styles.speiCreate}>
                  <input name="orderReference" type="hidden" value={order.reference} />
                  <label>
                    <span>CUENTA DE DESTINO</span>
                    <select defaultValue="" name="bankAccountId" required>
                      <option disabled value="">
                        SELECCIONA UNA CUENTA
                      </option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.alias}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">EMITIR COTIZACIÓN SPEI</button>
                  <p>
                    Genera un PDF formal e inmutable con el descuento, CLABE, referencia
                    única y vigencia. Una nueva cotización crea una nueva versión
                    auditada.
                  </p>
                </form>
              ) : (
                <p className={styles.unavailable}>
                  La transferencia SPEI estará disponible cuando operación habilite una
                  cuenta de destino y sus condiciones comerciales.
                </p>
              )}
            </article>
          </section>
        )}

        {order.payments.length ? (
          <section className={styles.history}>
            <p>HISTORIAL DE OPERACIONES</p>
            <ul>
              {order.payments.map((payment, index) => (
                <li
                  key={`${payment.provider}-${payment.updatedAt.toISOString()}-${index}`}
                >
                  <strong>
                    {payment.provider === "SPEI" ? "TRANSFERENCIA SPEI" : "MERCADO PAGO"}
                  </strong>
                  <span>{paymentStatusLabel(payment.status)}</span>
                  <small>{dateTime(payment.updatedAt)}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
