import type { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import { reviewCommerceOrder } from "./actions";

import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Pedidos comerciales"
};

type OrdersPageProps = {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
};

const perPage = 25;

const orderLabels = {
  CANCELLED: "CANCELADO",
  CONFIRMED: "CONFIRMADO",
  FULFILLED: "ENTREGADO",
  REQUESTED: "RECIBIDO",
  REVIEWING: "EN VALIDACIÓN"
} as const;

const statuses = Object.keys(orderLabels) as Array<keyof typeof orderLabels>;

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

export default async function CommerceOrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const status = statuses.includes(params.status as keyof typeof orderLabels)
    ? (params.status as keyof typeof orderLabels)
    : undefined;
  const where: Prisma.CommerceOrderWhereInput = {
    status,
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
  const totalPromise = database.commerceOrder.count({ where });
  const total = await totalPromise;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(pageNumber(params.page), totalPages);
  const [orders, statusCounts] = await Promise.all([
    database.commerceOrder.findMany({
      include: {
        _count: { select: { items: true } },
        account: { select: { companyName: true, contactName: true } },
        requestedBy: { select: { email: true, name: true } },
        reviewedBy: { select: { email: true } }
      },
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      skip: (currentPage - 1) * perPage,
      take: perPage,
      where
    }),
    database.commerceOrder.groupBy({ by: ["status"], _count: { _all: true } })
  ]);
  const counts = new Map(statusCounts.map((item) => [item.status, item._count._all]));
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (status) next.set("status", status);
    if (page > 1) next.set("page", String(page));
    const encoded = next.toString();
    return encoded ? `/admin/pedidos?${encoded}` : "/admin/pedidos";
  };

  return (
    <section className={styles.page}>
      <header>
        <p>SUPPLY_SYSTEM / ORDER_CONTROL</p>
        <h1>Pedidos sin cobro automático.</h1>
        <span>
          Confirma existencias, entrega y condiciones antes de activar un pedido. La
          pasarela de pago permanece fuera de este flujo.
        </span>
      </header>

      <dl className={styles.metrics}>
        {statuses.map((item) => (
          <div key={item}>
            <dt>{orderLabels[item]}</dt>
            <dd>{counts.get(item) ?? 0}</dd>
          </div>
        ))}
      </dl>

      <form className={styles.search} method="get">
        <label>
          <span>BUSCAR PEDIDO</span>
          <input
            defaultValue={query}
            name="q"
            placeholder="Referencia, empresa, correo o SKU"
            type="search"
          />
        </label>
        <label>
          <span>ESTADO</span>
          <select defaultValue={status ?? ""} name="status">
            <option value="">Todos los estados</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {orderLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">FILTRAR</button>
        {query || status ? <Link href="/admin/pedidos">LIMPIAR</Link> : null}
        <output>{total} PEDIDOS</output>
      </form>

      {orders.length ? (
        <div className={styles.list}>
          {orders.map((order) => (
            <article key={order.id}>
              <header className={styles.orderHeader}>
                <div>
                  <p>{order.reference}</p>
                  <h2>{upper(order.account.companyName)}</h2>
                  <span>
                    {order.requestedBy?.name ?? order.account.contactName} ·{" "}
                    {order.requestedBy?.email ?? "SIN CORREO"}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>RECIBIDO</dt>
                    <dd>{dateLabel(order.requestedAt)}</dd>
                  </div>
                  <div>
                    <dt>PARTIDAS</dt>
                    <dd>{order._count.items}</dd>
                  </div>
                  <div>
                    <dt>REVISÓ</dt>
                    <dd>{order.reviewedBy?.email ?? "PENDIENTE"}</dd>
                  </div>
                </dl>
              </header>
              {order.customerNotes ? (
                <p className={styles.notes}>NOTA DEL CLIENTE: {order.customerNotes}</p>
              ) : null}
              <form action={reviewCommerceOrder} className={styles.review}>
                <input name="orderId" type="hidden" value={order.id} />
                <label>
                  <span>ESTADO OPERATIVO</span>
                  <select defaultValue={order.status} name="status">
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {orderLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>NOTA INTERNA / NO VISIBLE PARA CLIENTE</span>
                  <textarea
                    defaultValue={order.adminNotes ?? ""}
                    name="adminNotes"
                    placeholder="Existencia confirmada, entrega, responsable o incidencia..."
                    rows={3}
                  />
                </label>
                <div className={styles.reviewActions}>
                  <a
                    href={`/api/commerce/orders/${encodeURIComponent(order.reference)}/pdf`}
                  >
                    DOCUMENTO PDF
                  </a>
                  <button type="submit">GUARDAR ESTADO</button>
                </div>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>No hay pedidos con esos filtros.</h2>
          <span>Los pedidos enviados por clientes aprobados aparecerán aquí.</span>
        </section>
      )}

      {total > perPage ? (
        <nav aria-label="Paginación de pedidos" className={styles.pagination}>
          <span>
            PÁGINA {currentPage} DE {totalPages} / {total} PEDIDOS
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
