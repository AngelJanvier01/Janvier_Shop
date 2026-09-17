import { formatMxn, getAccountPriceWithTax } from "@/lib/commerce/catalog";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Solicitudes de cotización"
};

function dateLabel(value: Date | null) {
  if (!value) return "PENDIENTE";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

export default async function QuoteRequestsPage() {
  const requests = await database.commerceCart.findMany({
    include: {
      account: {
        select: { commercialDiscountPct: true, companyName: true, contactName: true }
      },
      items: {
        include: {
          product: {
            select: { basePriceWithTax: true, brand: true, name: true, sku: true }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      requestedBy: { select: { email: true, name: true } }
    },
    orderBy: { requestedAt: "desc" },
    take: 60,
    where: { status: "QUOTE_REQUESTED" }
  });

  return (
    <section className={styles.page}>
      <header>
        <p>SUPPLY_SYSTEM / QUOTE_INBOX</p>
        <h1>Solicitudes de cotización.</h1>
        <span>
          Estas solicitudes no se cobran. Revisa existencias, vigencia y condiciones antes
          de crear una propuesta formal.
        </span>
      </header>

      {requests.length ? (
        <div className={styles.list}>
          {requests.map((request) => {
            const total = request.items.reduce((sum, item) => {
              const price = item.snapshotAt
                ? item.snapshotUnitPriceWithTax === null
                  ? null
                  : Number(item.snapshotUnitPriceWithTax)
                : getAccountPriceWithTax(
                    item.product.basePriceWithTax,
                    request.account.commercialDiscountPct
                  );
              return price === null ? sum : sum + price * item.quantity;
            }, 0);
            const hasMissingPrice = request.items.some((item) => {
              if (item.snapshotAt) return item.snapshotUnitPriceWithTax === null;
              return (
                getAccountPriceWithTax(
                  item.product.basePriceWithTax,
                  request.account.commercialDiscountPct
                ) === null
              );
            });
            return (
              <article key={request.id}>
                <header className={styles.requestHeader}>
                  <div>
                    <p>{request.reference ?? "COTIZACIÓN SIN REFERENCIA"}</p>
                    <h2>{upper(request.account.companyName)}</h2>
                    <span>
                      {request.account.contactName} ·{" "}
                      {request.requestedBy?.email ?? "SIN CORREO"}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>RECIBIDA</dt>
                      <dd>{dateLabel(request.requestedAt)}</dd>
                    </div>
                    <div>
                      <dt>ESTIMADO C/IVA</dt>
                      <dd>{hasMissingPrice ? "VALIDAR" : formatMxn(total)}</dd>
                    </div>
                  </dl>
                </header>
                <ul>
                  {request.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {upper(item.snapshotBrand ?? item.product.brand ?? "JANVIER")} /{" "}
                        {upper(item.snapshotName ?? item.product.name)}
                      </span>
                      <b>SKU {upper(item.snapshotSku ?? item.product.sku)}</b>
                      <em>{item.quantity} PZS.</em>
                    </li>
                  ))}
                </ul>
                {request.customerNotes ? (
                  <p className={styles.notes}>
                    NOTA DEL CLIENTE: {request.customerNotes}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>La bandeja está lista.</h2>
          <span>
            Las solicitudes de los clientes aprobados aparecerán aquí al enviarlas desde
            su lista.
          </span>
        </div>
      )}
    </section>
  );
}
