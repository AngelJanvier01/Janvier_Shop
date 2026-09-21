import Link from "next/link";

import { CustomerLogoutButton } from "@/components/commerce/customer-logout-button";
import { SupplySubheader } from "@/components/commerce/supply-subheader";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { requireCurrentCustomer } from "@/lib/auth/current-customer";
import { getCartQuantity } from "@/lib/commerce/cart-quantity";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Mi cuenta comercial"
};

const orderLabels = {
  CANCELLED: "CANCELADO",
  CONFIRMED: "CONFIRMADO",
  FULFILLED: "ENTREGADO",
  REQUESTED: "RECIBIDO",
  REVIEWING: "EN VALIDACIÓN"
} as const;

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(value);
}

export default async function CustomerAccountPage() {
  const customer = await requireCurrentCustomer();
  const [activeCart, quotes, orders] = await Promise.all([
    database.commerceCart.findFirst({
      select: { items: { select: { quantity: true } } },
      where: { accountId: customer.accountId, status: "ACTIVE" }
    }),
    database.commerceCart.findMany({
      orderBy: { requestedAt: "desc" },
      select: {
        _count: { select: { items: true } },
        id: true,
        order: { select: { paymentStatus: true, reference: true, status: true } },
        reference: true,
        requestedAt: true
      },
      take: 20,
      where: { accountId: customer.accountId, status: "QUOTE_REQUESTED" }
    }),
    database.commerceOrder.findMany({
      orderBy: { requestedAt: "desc" },
      select: {
        _count: { select: { items: true } },
        reference: true,
        requestedAt: true,
        status: true,
        paymentStatus: true
      },
      take: 20,
      where: { accountId: customer.accountId }
    })
  ]);

  const discount = customer.account.commercialDiscountPct;

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
            <p>MI CUENTA JANVIER</p>
            <h1>Tu cuenta comercial.</h1>
            <span>Consulta precios, solicitudes, pedidos y documentos.</span>
          </div>
          <div className={styles.heroActions}>
            <Link href="/suministro/carrito">VER MI CARRITO</Link>
            <CustomerLogoutButton />
          </div>
        </header>

        <section className={styles.metrics} aria-label="Resumen de la cuenta">
          <div>
            <span>LISTA ACTIVA</span>
            <strong>{getCartQuantity(activeCart?.items)}</strong>
            <small>PIEZAS EN CARRITO</small>
          </div>
          <div>
            <span>SOLICITUDES</span>
            <strong>{quotes.length}</strong>
            <small>HISTORIAL DISPONIBLE</small>
          </div>
          <div>
            <span>PEDIDOS</span>
            <strong>{orders.length}</strong>
            <small>SEGUIMIENTO Y PAGO SEGURO</small>
          </div>
        </section>

        <section className={styles.grid}>
          <section className={styles.profile}>
            <header>
              <p>PERFIL COMERCIAL</p>
              <h2>Datos y condiciones comerciales.</h2>
            </header>
            <dl>
              <div>
                <dt>EMPRESA</dt>
                <dd>{upper(customer.account.companyName)}</dd>
              </div>
              <div>
                <dt>CONTACTO</dt>
                <dd>{upper(customer.name)}</dd>
              </div>
              <div>
                <dt>CORREO</dt>
                <dd>{customer.email}</dd>
              </div>
              <div>
                <dt>LISTA</dt>
                <dd>{upper(customer.account.priceListCode ?? "PRECIO VALIDADO")}</dd>
              </div>
              <div>
                <dt>DESCUENTO COMERCIAL</dt>
                <dd>{discount === null ? "A CONFIRMAR" : `${discount}%`}</dd>
              </div>
            </dl>
            <p className={styles.assurance}>
              Tus precios incluyen IVA. Cada cotización y pedido se valida con existencia,
              vigencia, entrega y garantía antes de cualquier cobro.
            </p>
          </section>

          <section className={styles.orders}>
            <header>
              <p>PEDIDOS</p>
              <h2>Estado de tus pedidos.</h2>
            </header>
            {orders.length ? (
              <ul>
                {orders.map((order) => (
                  <li key={order.reference}>
                    <div>
                      <strong>{order.reference}</strong>
                      <span>{dateLabel(order.requestedAt)}</span>
                    </div>
                    <b>{orderLabels[order.status]}</b>
                    <small>{order._count.items} PARTIDAS</small>
                    <a
                      href={`/api/commerce/orders/${encodeURIComponent(order.reference)}/pdf`}
                    >
                      PDF
                    </a>
                    <Link
                      href={`/suministro/pagos/${encodeURIComponent(order.reference)}`}
                    >
                      {order.status === "CONFIRMED" ? "PAGAR" : "VER PAGO"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>
                AÚN NO HAY PEDIDOS. PUEDES CREAR UNO DESDE UNA COTIZACIÓN.
              </p>
            )}
          </section>
        </section>

        <section className={styles.quotes}>
          <header>
            <p>COTIZACIONES</p>
            <h2>Solicitudes anteriores.</h2>
          </header>
          {quotes.length ? (
            <ul>
              {quotes.map((quote) => (
                <li key={quote.id}>
                  <div>
                    <strong>{quote.reference ?? "COTIZACIÓN EN PREPARACIÓN"}</strong>
                    <span>
                      {quote.requestedAt ? dateLabel(quote.requestedAt) : "PENDIENTE"}
                    </span>
                  </div>
                  <small>{quote._count.items} PARTIDAS</small>
                  {quote.order ? (
                    <b>
                      {quote.order.reference} / {orderLabels[quote.order.status]}
                    </b>
                  ) : (
                    <em>LISTA PARA RECUPERAR O CONVERTIR EN PEDIDO</em>
                  )}
                  <Link href="/suministro/carrito">ABRIR</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>
              TU HISTORIAL APARECERÁ AQUÍ DESPUÉS DE ENVIAR UNA SOLICITUD.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
