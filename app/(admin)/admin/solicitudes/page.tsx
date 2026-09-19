import type { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import { formatMxn, getAccountPriceWithTax } from "@/lib/commerce/catalog";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Solicitudes de cotización"
};

type QuoteRequestsPageProps = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

const quotesPerPage = 25;

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

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

export default async function QuoteRequestsPage({
  searchParams
}: QuoteRequestsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const where: Prisma.CommerceCartWhereInput = {
    status: "QUOTE_REQUESTED",
    ...(query
      ? {
          OR: [
            { reference: { contains: query, mode: "insensitive" } },
            { account: { companyName: { contains: query, mode: "insensitive" } } },
            { account: { contactName: { contains: query, mode: "insensitive" } } },
            { requestedBy: { email: { contains: query, mode: "insensitive" } } },
            {
              items: {
                some: {
                  OR: [
                    { snapshotName: { contains: query, mode: "insensitive" } },
                    { snapshotSku: { contains: query, mode: "insensitive" } },
                    { product: { name: { contains: query, mode: "insensitive" } } },
                    { product: { sku: { contains: query, mode: "insensitive" } } }
                  ]
                }
              }
            }
          ]
        }
      : {})
  };
  const total = await database.commerceCart.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / quotesPerPage));
  const currentPage = Math.min(pageNumber(params.page), totalPages);
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (page > 1) next.set("page", String(page));
    const encoded = next.toString();
    return encoded ? `/admin/solicitudes?${encoded}` : "/admin/solicitudes";
  };
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
    skip: (currentPage - 1) * quotesPerPage,
    take: quotesPerPage,
    where
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

      <form className={styles.search} method="get">
        <label>
          <span>BUSCAR SOLICITUD</span>
          <input
            defaultValue={query}
            name="q"
            placeholder="Referencia, empresa, correo, SKU o producto"
            type="search"
          />
        </label>
        <button type="submit">BUSCAR</button>
        {query ? <Link href="/admin/solicitudes">LIMPIAR</Link> : null}
        <output>{total} ABIERTAS</output>
      </form>

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
      {total > quotesPerPage ? (
        <nav aria-label="Paginación de solicitudes" className={styles.pagination}>
          <span>
            PÁGINA {currentPage} DE {totalPages} / {total} SOLICITUDES
          </span>
          <div>
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)}>ANTERIOR</Link>
            ) : null}
            {currentPage < totalPages ? (
              <Link href={pageHref(currentPage + 1)}>SIGUIENTE</Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
