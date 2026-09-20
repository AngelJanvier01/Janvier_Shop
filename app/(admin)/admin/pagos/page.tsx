import type { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import { reviewSpeiPayment } from "./actions";

import { database } from "@/lib/database";
import { paymentStatusLabel } from "@/lib/commerce/payment-core";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Control de pagos"
};

type PaymentsPageProps = {
  searchParams: Promise<{
    page?: string;
    provider?: string;
    q?: string;
    status?: string;
  }>;
};

const paymentStatuses = [
  "AWAITING_PAYMENT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "REFUNDED",
  "CHARGED_BACK",
  "CANCELLED"
] as const;
const providers = ["MERCADO_PAGO", "SPEI"] as const;
const perPage = 25;

function pageNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function date(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

export default async function PaymentsControlPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const status = paymentStatuses.includes(
    params.status as (typeof paymentStatuses)[number]
  )
    ? (params.status as (typeof paymentStatuses)[number])
    : undefined;
  const provider = providers.includes(params.provider as (typeof providers)[number])
    ? (params.provider as (typeof providers)[number])
    : undefined;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const where: Prisma.CommercePaymentWhereInput = {
    provider,
    status,
    ...(query
      ? {
          OR: [
            { externalReference: { contains: query, mode: "insensitive" } },
            { order: { reference: { contains: query, mode: "insensitive" } } },
            { account: { companyName: { contains: query, mode: "insensitive" } } },
            { speiQuote: { reference: { contains: query, mode: "insensitive" } } }
          ]
        }
      : {})
  };
  const totalPromise = database.commercePayment.count({ where });
  const [payments, statusCounts, total] = await Promise.all([
    database.commercePayment.findMany({
      include: {
        account: { select: { companyName: true, contactName: true } },
        order: { select: { paymentStatus: true, reference: true, status: true } },
        requestedBy: { select: { email: true, name: true } },
        speiQuote: {
          include: {
            proofs: {
              orderBy: { createdAt: "desc" },
              select: { id: true, originalFileName: true }
            }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (pageNumber(params.page) - 1) * perPage,
      take: perPage,
      where
    }),
    database.commercePayment.groupBy({ by: ["status"], _count: { _all: true } }),
    totalPromise
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(pageNumber(params.page), totalPages);
  const countByStatus = new Map(
    statusCounts.map((item) => [item.status, item._count._all])
  );
  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    if (provider) next.set("provider", provider);
    if (status) next.set("status", status);
    if (query) next.set("q", query);
    if (page > 1) next.set("page", String(page));
    return `/admin/pagos${next.size ? `?${next}` : ""}`;
  };

  return (
    <section className={styles.page}>
      <header>
        <div>
          <p>SUPPLY_SYSTEM / PAYMENT_OPERATIONS</p>
          <h1>Pagos que sí se pueden auditar.</h1>
          <span>
            Mercado Pago sólo cambia después de verificación del servidor. SPEI requiere
            conciliación explícita: un comprobante nunca confirma un pago por sí mismo.
          </span>
        </div>
        <Link href="/admin/ajustes/pagos">AJUSTES DE PAGO</Link>
      </header>

      <dl className={styles.metrics}>
        {paymentStatuses.slice(0, 6).map((item) => (
          <div key={item}>
            <dt>{paymentStatusLabel(item)}</dt>
            <dd>{countByStatus.get(item) ?? 0}</dd>
          </div>
        ))}
      </dl>

      <form className={styles.search} method="get">
        <label>
          <span>BUSCAR</span>
          <input
            defaultValue={query}
            name="q"
            placeholder="Pedido, folio, empresa o referencia"
            type="search"
          />
        </label>
        <label>
          <span>CANAL</span>
          <select defaultValue={provider ?? ""} name="provider">
            <option value="">Todos</option>
            {providers.map((item) => (
              <option key={item} value={item}>
                {item === "SPEI" ? "SPEI" : "MERCADO PAGO"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>ESTADO</span>
          <select defaultValue={status ?? ""} name="status">
            <option value="">Todos</option>
            {paymentStatuses.map((item) => (
              <option key={item} value={item}>
                {paymentStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">FILTRAR</button>
        {query || provider || status ? <Link href="/admin/pagos">LIMPIAR</Link> : null}
      </form>

      <p className={styles.total}>
        {total} OPERACIONES / PÁGINA {currentPage} DE {totalPages}
      </p>
      {payments.length ? (
        <div className={styles.list}>
          {payments.map((payment) => (
            <article key={payment.id}>
              <header className={styles.paymentHeader}>
                <div>
                  <p>
                    {payment.provider === "SPEI" ? "TRANSFERENCIA SPEI" : "MERCADO PAGO"}
                  </p>
                  <h2>{payment.speiQuote?.reference ?? payment.order.reference}</h2>
                  <span>
                    {upper(payment.account.companyName)} ·{" "}
                    {payment.requestedBy?.email ?? "SIN CORREO"}
                  </span>
                  <b data-status={payment.status}>{paymentStatusLabel(payment.status)}</b>
                </div>
                <dl>
                  <div>
                    <dt>IMPORTE</dt>
                    <dd>
                      $
                      {Number(payment.amount).toLocaleString("es-MX", {
                        minimumFractionDigits: 2
                      })}{" "}
                      MXN
                    </dd>
                  </div>
                  <div>
                    <dt>PEDIDO</dt>
                    <dd>{payment.order.reference}</dd>
                  </div>
                  <div>
                    <dt>ACTUALIZADO</dt>
                    <dd>{date(payment.updatedAt)}</dd>
                  </div>
                </dl>
              </header>
              {payment.provider === "MERCADO_PAGO" ? (
                <div className={styles.providerDetails}>
                  <span>ORDER MP: {payment.providerOrderId ?? "EN VERIFICACIÓN"}</span>
                  <span>STATUS MP: {payment.providerStatus ?? "PENDIENTE"}</span>
                  <span>DETALLE: {payment.providerStatusDetail ?? "—"}</span>
                </div>
              ) : (
                <div className={styles.speiDetails}>
                  <div>
                    <span>COTIZACIÓN / VIGENCIA</span>
                    <strong>{payment.speiQuote?.reference ?? "—"}</strong>
                    <small>
                      {payment.speiQuote ? date(payment.speiQuote.expiresAt) : "—"}
                    </small>
                  </div>
                  <div>
                    <span>COMPROBANTES</span>
                    {payment.speiQuote?.proofs.length ? (
                      <ul>
                        {payment.speiQuote.proofs.map((proof) => (
                          <li key={proof.id}>
                            <a
                              href={`/api/commerce/spei-proofs/${encodeURIComponent(proof.id)}`}
                            >
                              {proof.originalFileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>SIN COMPROBANTE</small>
                    )}
                  </div>
                  <div>
                    <a
                      href={`/api/commerce/spei-quotes/${encodeURIComponent(payment.speiQuote?.reference ?? "")}/pdf`}
                    >
                      ABRIR PDF DEFINITIVO
                    </a>
                  </div>
                </div>
              )}
              {payment.provider === "SPEI" && payment.status !== "APPROVED" ? (
                <form action={reviewSpeiPayment} className={styles.review}>
                  <input name="paymentId" type="hidden" value={payment.id} />
                  <label>
                    <span>ACCIÓN DE CONCILIACIÓN</span>
                    <select defaultValue="REQUEST_REVIEW" name="action">
                      <option value="REQUEST_REVIEW">
                        SOLICITAR / MANTENER REVISIÓN
                      </option>
                      <option value="CONFIRM">CONFIRMAR PAGO</option>
                      <option value="REJECT">RECHAZAR COMPROBANTE</option>
                      <option value="CANCEL">CANCELAR COTIZACIÓN</option>
                    </select>
                  </label>
                  <label>
                    <span>NOTA INTERNA / AUDITORÍA</span>
                    <textarea
                      defaultValue={payment.reviewNotes ?? ""}
                      name="notes"
                      placeholder="Banco, importe recibido, movimiento o motivo de revisión…"
                      rows={3}
                    />
                  </label>
                  <button type="submit">GUARDAR CONCILIACIÓN</button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>No hay operaciones con estos filtros.</h2>
        </section>
      )}
      {totalPages > 1 ? (
        <nav aria-label="Paginación de pagos" className={styles.pagination}>
          {currentPage > 1 ? (
            <Link href={pageHref(currentPage - 1)}>ANTERIOR</Link>
          ) : (
            <span />
          )}
          {currentPage < totalPages ? (
            <Link href={pageHref(currentPage + 1)}>SIGUIENTE</Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
