import Link from "next/link";

import {
  removeCartItem,
  requestCartQuote,
  updateCartItem
} from "@/app/suministro/commerce-actions";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { requireCurrentCustomer } from "@/lib/auth/current-customer";
import {
  formatMxn,
  getAccountPriceWithTax,
  getProductGallery,
  getProductImageFrameColors
} from "@/lib/commerce/catalog";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type CartPageProps = {
  searchParams: Promise<{ added?: string; error?: string; requested?: string }>;
};

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Mi solicitud de cotización"
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
  const [customer, params] = await Promise.all([requireCurrentCustomer(), searchParams]);
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
                  select: { id: true, processingVersion: true, sourceUrl: true },
                  where: { status: "APPROVED" }
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
      select: { id: true, reference: true, requestedAt: true, status: true },
      take: 5,
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
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p>SUPPLY_SYSTEM / QUOTE_LIST</p>
            <h1>Tu lista de cotización.</h1>
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

        {params.added ? (
          <p className={styles.notice}>PRODUCTO AGREGADO A TU LISTA DE COTIZACIÓN.</p>
        ) : null}
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
                    item.product.imageFrameColors
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
            <p className={styles.paymentNotice}>PAGO EN LÍNEA AÚN NO DISPONIBLE.</p>
          </aside>
        </section>

        {requests.length ? (
          <section className={styles.requests}>
            <header>
              <p>HISTORIAL RECIENTE</p>
              <h2>Solicitudes enviadas.</h2>
            </header>
            <ul>
              {requests.map((request) => (
                <li key={request.id}>
                  <strong>{request.reference ?? "COTIZACIÓN EN PREPARACIÓN"}</strong>
                  <span>
                    {request.requestedAt
                      ? requestedDate(request.requestedAt)
                      : "PENDIENTE"}
                  </span>
                  <em>RECIBIDA</em>
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
