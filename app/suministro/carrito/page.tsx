import Link from "next/link";

import {
  removeCartItem,
  requestOrderFromQuote,
  requestCartQuote,
  restoreQuoteToCart,
  updateCartItem
} from "@/app/suministro/commerce-actions";
import { CartAddedNotice } from "@/components/commerce/cart-added-notice";
import { SiteFooter } from "@/components/layout/site-footer";
import { GuestCartWorkspace } from "@/components/commerce/guest-cart-workspace";
import { SiteHeader } from "@/components/layout/site-header";
import { SupplySubheader } from "@/components/commerce/supply-subheader";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { getCartQuantity } from "@/lib/commerce/cart-quantity";
import {
  formatMxn,
  getAccountPriceWithTax,
  getProductGallery,
  getProductImageFrameColors
} from "@/lib/commerce/catalog";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type CartPageProps = {
  searchParams: Promise<{
    added?: string;
    error?: string;
    requested?: string;
    orderRequested?: string;
    restored?: string;
  }>;
};

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Carrito"
};

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function requestedDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(value);
}

export default async function CartPage({ searchParams }: CartPageProps) {
  const [customer, params] = await Promise.all([getCurrentCustomer(), searchParams]);
  if (!customer) {
    return (
      <>
        <SiteHeader />
        <SupplySubheader />
        <main>
          <GuestCartWorkspace />
        </main>
        <SiteFooter />
      </>
    );
  }
  const [activeCart, requests] = await Promise.all([
    database.commerceCart.findFirst({
      include: {
        items: {
          include: {
            product: {
              select: {
                basePriceWithTax: true,
                brand: true,
                galleryUrls: true,
                imageFrameColors: true,
                imageDerivatives: {
                  orderBy: { sourcePosition: "asc" },
                  select: {
                    id: true,
                    processingVersion: true,
                    sourceUrl: true,
                    status: true
                  },
                  where: {
                    OR: [
                      { status: "APPROVED" },
                      {
                        reviewedAt: { not: null },
                        status: { in: ["PENDING", "PROCESSING", "RETRY"] }
                      }
                    ],
                    storageKey: { not: null }
                  }
                },
                imageUrl: true,
                name: true,
                slug: true,
                sku: true,
                warrantyYears: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { updatedAt: "desc" },
      where: { accountId: customer.accountId, status: "ACTIVE" }
    }),
    database.commerceCart.findMany({
      orderBy: { requestedAt: "desc" },
      include: {
        order: { select: { paymentStatus: true, reference: true, status: true } },
        items: {
          include: {
            product: {
              select: {
                basePriceWithTax: true,
                brand: true,
                name: true,
                sku: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      take: 20,
      where: { accountId: customer.accountId, status: "QUOTE_REQUESTED" }
    })
  ]);

  const discount = customer.account.commercialDiscountPct;
  const items = activeCart?.items ?? [];
  const total = items.reduce((sum, item) => {
    const price = getAccountPriceWithTax(item.product.basePriceWithTax, discount);
    return price === null ? sum : sum + price * item.quantity;
  }, 0);
  const priceIsPartial = items.some(
    (item) => getAccountPriceWithTax(item.product.basePriceWithTax, discount) === null
  );

  return (
    <>
      <SiteHeader />
      <SupplySubheader
        cartItemCount={getCartQuantity(items)}
        companyName={customer.account.companyName}
        customerName={customer.name}
      />
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p>TU CARRITO JANVIER</p>
            <h1>Tu carrito.</h1>
          </div>
          <dl>
            <div>
              <dt>CUENTA</dt>
              <dd>{upper(customer.account.companyName)}</dd>
            </div>
            <div>
              <dt>CONDICIÓN COMERCIAL</dt>
              <dd>
                {customer.account.priceListCode
                  ? upper(customer.account.priceListCode)
                  : "PRECIO VALIDADO"}
              </dd>
            </div>
          </dl>
        </header>

        {params.added ? <CartAddedNotice /> : null}
        {params.error === "empty" ? (
          <p className={styles.error}>
            AGREGA AL MENOS UN PRODUCTO ANTES DE ENVIAR LA SOLICITUD.
          </p>
        ) : null}
        {params.requested ? (
          <section className={styles.confirmation}>
            <p>SOLICITUD RECIBIDA</p>
            <h2>{params.requested}</h2>
            <span>
              Tu ejecutivo validará existencias, precio final, envío y condiciones antes
              de enviarte una cotización formal. El pago permanece desactivado.
            </span>
            <Link href="/suministro/catalogo">SEGUIR EXPLORANDO</Link>
          </section>
        ) : null}
        {params.orderRequested ? (
          <section className={styles.confirmation}>
            <p>PEDIDO RECIBIDO</p>
            <h2>{params.orderRequested}</h2>
            <span>
              Recibimos tu intención de compra. Un ejecutivo confirmará existencia,
              entrega y vigencia antes de activar cualquier forma de pago.
            </span>
            <Link href="/suministro/mi-cuenta">VER MI OPERACIÓN</Link>
          </section>
        ) : null}
        {params.restored ? (
          <p className={styles.notice}>
            {params.restored} SE COPIÓ A TU LISTA ACTIVA. REVISA CANTIDADES Y ENVÍA UNA
            NUEVA SOLICITUD CUANDO ESTÉ LISTA.
          </p>
        ) : null}

        <section className={styles.workspace}>
          <div className={styles.items}>
            <header>
              <p>PRODUCTOS / {items.length}</p>
              <span>Las cantidades se validan con disponibilidad real.</span>
            </header>
            {items.length ? (
              <div className={styles.itemList}>
                {items.map((item) => {
                  const images = getProductGallery(
                    item.product.imageUrl,
                    item.product.galleryUrls,
                    item.product.imageDerivatives
                  );
                  const frameColors = getProductImageFrameColors(
                    item.product.imageUrl,
                    item.product.galleryUrls,
                    item.product.imageFrameColors,
                    item.product.imageDerivatives
                  );
                  const price = getAccountPriceWithTax(
                    item.product.basePriceWithTax,
                    discount
                  );
                  return (
                    <article key={item.id}>
                      <Link
                        aria-label={`Ver ${item.product.name}`}
                        className={styles.itemImage}
                        href={`/suministro/catalogo/${item.product.slug}`}
                        style={{ backgroundColor: frameColors[0] }}
                      >
                        {images[0] ? (
                          // El proveedor puede servir imágenes desde múltiples dominios configurables.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt=""
                            className={styles.itemImageForeground}
                            src={images[0]}
                          />
                        ) : (
                          <span>FICHA</span>
                        )}
                      </Link>
                      <div className={styles.itemCopy}>
                        <p>{upper(item.product.brand ?? "JANVIER VERIFIED")}</p>
                        <h2>{upper(item.product.name)}</h2>
                        <span>
                          SKU {upper(item.product.sku)} · GARANTÍA{" "}
                          {item.product.warrantyYears ?? "—"} AÑOS
                        </span>
                      </div>
                      <div className={styles.itemCommercial}>
                        <strong>{formatMxn(price)}</strong>
                        <span>
                          {price === null ? "PRECIO A CONFIRMAR" : "IVA INCLUIDO"}
                        </span>
                        <form action={updateCartItem}>
                          <input name="cartItemId" type="hidden" value={item.id} />
                          <label>
                            <span>CANT.</span>
                            <input
                              defaultValue={item.quantity}
                              max="999"
                              min="1"
                              name="quantity"
                              type="number"
                            />
                          </label>
                          <button type="submit">ACTUALIZAR</button>
                        </form>
                        <form action={removeCartItem}>
                          <input name="cartItemId" type="hidden" value={item.id} />
                          <button type="submit">QUITAR</button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <h2>Aún no agregas equipo a tu lista.</h2>
                <span>
                  Explora las fichas técnicas y agrega los productos que quieres validar.
                </span>
                <Link href="/suministro/catalogo">EXPLORAR CATÁLOGO</Link>
              </div>
            )}
          </div>

          <aside className={styles.summary}>
            <p>RESUMEN COMERCIAL</p>
            <dl>
              <div>
                <dt>PARTIDAS</dt>
                <dd>{items.length}</dd>
              </div>
              <div>
                <dt>ESTIMADO C/IVA</dt>
                <dd>
                  {items.length && !priceIsPartial ? formatMxn(total) : "A CONFIRMAR"}
                </dd>
              </div>
            </dl>
            <span>
              {priceIsPartial
                ? "Una o más fichas requieren precio validado por tu ejecutivo."
                : "El total es referencial hasta validar existencia y vigencia."}
            </span>
            {items.length ? (
              <form action={requestCartQuote}>
                <label>
                  <span>NOTA PARA TU EJECUTIVO / OPCIONAL</span>
                  <textarea
                    name="customerNotes"
                    placeholder="Proyecto, fecha objetivo, configuración o entrega..."
                    rows={4}
                  />
                </label>
                <button type="submit">SOLICITAR COTIZACIÓN</button>
              </form>
            ) : null}
            <p className={styles.paymentNotice}>
              EL PAGO SE HABILITA DESPUÉS DE CONFIRMAR EXISTENCIA, ENTREGA Y VIGENCIA.
            </p>
          </aside>
        </section>

        {requests.length ? (
          <section className={styles.requests}>
            <header>
              <p>HISTORIAL RECIENTE</p>
              <h2>Solicitudes y cotizaciones anteriores.</h2>
            </header>
            <ul>
              {requests.map((request) => {
                const quoteTotal = request.items.reduce((sum, item) => {
                  const price = item.snapshotAt
                    ? item.snapshotUnitPriceWithTax === null
                      ? null
                      : Number(item.snapshotUnitPriceWithTax)
                    : getAccountPriceWithTax(
                        item.product.basePriceWithTax,
                        customer.account.commercialDiscountPct
                      );
                  return price === null ? sum : sum + price * item.quantity;
                }, 0);
                const quoteNeedsReview = request.items.some((item) => {
                  if (item.snapshotAt) return item.snapshotUnitPriceWithTax === null;
                  return (
                    getAccountPriceWithTax(
                      item.product.basePriceWithTax,
                      customer.account.commercialDiscountPct
                    ) === null
                  );
                });
                return (
                  <li key={request.id}>
                    <div className={styles.requestSummary}>
                      <strong>{request.reference ?? "COTIZACIÓN EN PREPARACIÓN"}</strong>
                      <span>
                        {request.requestedAt
                          ? requestedDate(request.requestedAt)
                          : "PENDIENTE"}
                      </span>
                      <em>RECIBIDA</em>
                    </div>
                    <details>
                      <summary>
                        <span>{request.items.length} PARTIDAS</span>
                        <b>{quoteNeedsReview ? "VALIDAR" : formatMxn(quoteTotal)}</b>
                      </summary>
                      <div className={styles.quoteDetails}>
                        <ul>
                          {request.items.map((item) => (
                            <li key={item.id}>
                              <span>
                                {upper(
                                  item.snapshotBrand ?? item.product.brand ?? "JANVIER"
                                )}{" "}
                                / {upper(item.snapshotName ?? item.product.name)}
                              </span>
                              <b>SKU {upper(item.snapshotSku ?? item.product.sku)}</b>
                              <em>{item.quantity} PZS.</em>
                            </li>
                          ))}
                        </ul>
                        <form action={restoreQuoteToCart}>
                          <input name="quoteCartId" type="hidden" value={request.id} />
                          <button type="submit">COPIAR A MI LISTA ACTIVA</button>
                        </form>
                        {request.order ? (
                          <div className={styles.orderReference}>
                            <span>PEDIDO {request.order.reference}</span>
                            <b>{request.order.status}</b>
                            <a
                              href={`/api/commerce/orders/${encodeURIComponent(
                                request.order.reference
                              )}/pdf`}
                            >
                              DESCARGAR DOCUMENTO
                            </a>
                            <Link
                              href={`/suministro/pagos/${encodeURIComponent(request.order.reference)}`}
                            >
                              {request.order.status === "CONFIRMED"
                                ? "VER OPCIONES DE PAGO"
                                : "SEGUIMIENTO DE PAGO"}
                            </Link>
                          </div>
                        ) : (
                          <form action={requestOrderFromQuote}>
                            <input name="quoteCartId" type="hidden" value={request.id} />
                            <button type="submit">SOLICITAR PEDIDO</button>
                          </form>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
