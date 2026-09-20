import type { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import { updateAbandonedCartRecovery } from "./actions";

import { formatMxn, getAccountPriceWithTax } from "@/lib/commerce/catalog";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Carritos abandonados"
};

const cartsPerPage = 25;
const ageOptions = {
  "2h": { label: "2 HORAS", milliseconds: 2 * 60 * 60 * 1000 },
  "24h": { label: "24 HORAS", milliseconds: 24 * 60 * 60 * 1000 },
  "7d": { label: "7 DÍAS", milliseconds: 7 * 24 * 60 * 60 * 1000 }
} as const;
const recoveryLabels = {
  ALL: "TODOS",
  CONTACTED: "CONTACTADOS",
  DISMISSED: "DESCARTADOS",
  OPEN: "POR ATENDER"
} as const;

type RecoveryFilter = keyof typeof recoveryLabels;
type AbandonedCartsPageProps = {
  searchParams: Promise<{
    age?: string;
    page?: string;
    q?: string;
    saved?: string;
    status?: string;
  }>;
};

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

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

function statusLabel(status: "OPEN" | "CONTACTED" | "DISMISSED") {
  return recoveryLabels[status];
}

function estimatedTotal(cart: {
  account: { commercialDiscountPct: { toString(): string } | null };
  items: Array<{
    product: { basePriceWithTax: { toString(): string } | null };
    quantity: number;
    snapshotAt: Date | null;
    snapshotUnitPriceWithTax: { toString(): string } | null;
  }>;
}) {
  let hasMissingPrice = false;
  const total = cart.items.reduce((sum, item) => {
    const price = item.snapshotAt
      ? item.snapshotUnitPriceWithTax === null
        ? null
        : Number(item.snapshotUnitPriceWithTax)
      : getAccountPriceWithTax(
          item.product.basePriceWithTax,
          cart.account.commercialDiscountPct
        );
    if (price === null) {
      hasMissingPrice = true;
      return sum;
    }
    return sum + price * item.quantity;
  }, 0);
  return { hasMissingPrice, total };
}

export default async function AbandonedCartsPage({
  searchParams
}: AbandonedCartsPageProps) {
  const params = await searchParams;
  const age =
    params.age && params.age in ageOptions
      ? (params.age as keyof typeof ageOptions)
      : "24h";
  const recoveryFilter =
    params.status && params.status in recoveryLabels
      ? (params.status as RecoveryFilter)
      : "OPEN";
  const query = params.q?.trim().slice(0, 120) ?? "";
  const now = new Date();
  const inactiveSince = new Date(now.getTime() - ageOptions[age].milliseconds);
  const where: Prisma.CommerceCartWhereInput = {
    items: { some: {} },
    status: "ACTIVE",
    updatedAt: { lte: inactiveSince },
    ...(recoveryFilter === "OPEN"
      ? { OR: [{ recovery: null }, { recovery: { is: { status: "OPEN" } } }] }
      : recoveryFilter === "ALL"
        ? {}
        : { recovery: { is: { status: recoveryFilter } } }),
    ...(query
      ? {
          AND: [
            {
              OR: [
                { account: { companyName: { contains: query, mode: "insensitive" } } },
                { account: { contactName: { contains: query, mode: "insensitive" } } },
                {
                  account: {
                    users: { some: { email: { contains: query, mode: "insensitive" } } }
                  }
                },
                {
                  items: {
                    some: {
                      OR: [
                        { product: { name: { contains: query, mode: "insensitive" } } },
                        { product: { sku: { contains: query, mode: "insensitive" } } }
                      ]
                    }
                  }
                }
              ]
            }
          ]
        }
      : {})
  };
  const total = await database.commerceCart.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / cartsPerPage));
  const currentPage = Math.min(pageNumber(params.page), totalPages);
  const carts = await database.commerceCart.findMany({
    include: {
      account: {
        select: {
          commercialDiscountPct: true,
          companyName: true,
          contactName: true,
          users: {
            orderBy: { createdAt: "asc" },
            select: { email: true, name: true },
            take: 1,
            where: { role: "OWNER" }
          }
        }
      },
      items: {
        include: {
          product: {
            select: { basePriceWithTax: true, brand: true, name: true, sku: true }
          }
        },
        orderBy: { updatedAt: "desc" }
      },
      recovery: { select: { adminNotes: true, lastContactedAt: true, status: true } }
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    skip: (currentPage - 1) * cartsPerPage,
    take: cartsPerPage,
    where
  });
  const pageHref = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const nextAge = changes.age ?? age;
    const nextStatus = changes.status ?? recoveryFilter;
    const nextQuery = changes.q ?? query;
    const nextPage = changes.page;
    if (nextAge !== "24h") next.set("age", nextAge);
    if (nextStatus !== "OPEN") next.set("status", nextStatus);
    if (nextQuery) next.set("q", nextQuery);
    if (nextPage && nextPage !== "1") next.set("page", nextPage);
    const encoded = next.toString();
    return encoded
      ? `/admin/carritos-abandonados?${encoded}`
      : "/admin/carritos-abandonados";
  };
  const pageValue = carts.reduce((sum, cart) => sum + estimatedTotal(cart).total, 0);

  return (
    <section className={styles.page}>
      <header>
        <p>COMMERCE_RECOVERY / ACTIONABLE_PIPELINE</p>
        <h1>Carritos en pausa.</h1>
        <span>
          Personas con una lista comercial activa que no han vuelto en{" "}
          {ageOptions[age].label.toLowerCase()}. Un carrito no se contacta
          automáticamente: tú decides la recuperación y dejas evidencia.
        </span>
      </header>

      <section className={styles.metrics} aria-label="Resumen de carritos abandonados">
        <article>
          <span>EN ESTA BANDEJA</span>
          <strong>{total}</strong>
        </article>
        <article>
          <span>VALOR ESTIMADO / PÁGINA</span>
          <strong>{formatMxn(pageValue)}</strong>
        </article>
        <article>
          <span>INACTIVIDAD</span>
          <strong>{ageOptions[age].label}</strong>
        </article>
      </section>
      {params.saved === "1" ? (
        <p aria-live="polite" className={styles.saved} role="status">
          SEGUIMIENTO GUARDADO · AHORA ESTÁS VIENDO EL ESTADO ACTUALIZADO.
        </p>
      ) : null}

      <form className={styles.filters} method="get">
        <label>
          <span>BUSCAR CLIENTE O PRODUCTO</span>
          <input
            defaultValue={query}
            name="q"
            placeholder="Empresa, correo, SKU o producto"
            type="search"
          />
        </label>
        <label>
          <span>SIN ACTIVIDAD DESDE</span>
          <select defaultValue={age} name="age">
            {Object.entries(ageOptions).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>SEGUIMIENTO</span>
          <select defaultValue={recoveryFilter} name="status">
            {Object.entries(recoveryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">ACTUALIZAR</button>
        {query || age !== "24h" || recoveryFilter !== "OPEN" ? (
          <Link href="/admin/carritos-abandonados">LIMPIAR</Link>
        ) : null}
      </form>

      {carts.length ? (
        <div className={styles.list}>
          {carts.map((cart) => {
            const recoveryStatus =
              cart.recovery?.status === "CONTACTED" ||
              cart.recovery?.status === "DISMISSED"
                ? cart.recovery.status
                : "OPEN";
            const total = estimatedTotal(cart);
            const owner = cart.account.users[0];
            const emailHref = owner
              ? `mailto:${encodeURIComponent(owner.email)}?subject=${encodeURIComponent("Tu lista de cotización en JANVIER")}&body=${encodeURIComponent(`Hola ${owner.name}, vimos que tu lista comercial sigue disponible. ¿Te ayudamos a validar existencias y vigencia?`)}`
              : null;
            return (
              <article key={cart.id}>
                <header className={styles.cartHeader}>
                  <div>
                    <p>
                      {statusLabel(recoveryStatus)} / ÚLTIMA ACTIVIDAD{" "}
                      {dateLabel(cart.updatedAt)}
                    </p>
                    <h2>{upper(cart.account.companyName)}</h2>
                    <span>
                      {upper(cart.account.contactName)} ·{" "}
                      {owner?.email ?? "SIN CORREO PRINCIPAL"}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>PARTIDAS</dt>
                      <dd>{cart.items.length}</dd>
                    </div>
                    <div>
                      <dt>ESTIMADO C/IVA</dt>
                      <dd>
                        {total.hasMissingPrice ? "VALIDAR" : formatMxn(total.total)}
                      </dd>
                    </div>
                  </dl>
                </header>
                <ul>
                  {cart.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {upper(item.product.brand ?? "JANVIER")} /{" "}
                        {upper(item.product.name)}
                      </span>
                      <b>SKU {upper(item.product.sku)}</b>
                      <em>{item.quantity} PZS.</em>
                    </li>
                  ))}
                </ul>
                <form action={updateAbandonedCartRecovery} className={styles.recovery}>
                  <input name="cartId" type="hidden" value={cart.id} />
                  <input name="returnTo" type="hidden" value={pageHref({})} />
                  <label>
                    <span>ESTADO DE RECUPERACIÓN</span>
                    <select defaultValue={recoveryStatus} name="status">
                      <option value="OPEN">POR ATENDER</option>
                      <option value="CONTACTED">CONTACTADO</option>
                      <option value="DISMISSED">DESCARTADO</option>
                    </select>
                  </label>
                  <label>
                    <span>NOTA INTERNA</span>
                    <input
                      defaultValue={cart.recovery?.adminNotes ?? ""}
                      maxLength={2000}
                      name="adminNotes"
                      placeholder="Siguiente paso, contexto o motivo"
                    />
                  </label>
                  <button type="submit">GUARDAR</button>
                  {emailHref ? <a href={emailHref}>ESCRIBIR AL CLIENTE ↗</a> : null}
                  {cart.recovery?.lastContactedAt ? (
                    <small>
                      ÚLTIMO CONTACTO {dateLabel(cart.recovery.lastContactedAt)}
                    </small>
                  ) : null}
                </form>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>Bandeja despejada.</h2>
          <span>
            No hay carritos que coincidan con esta ventana y estos filtros. Cuando una
            persona solicite cotización, desaparece de aquí y entra en Solicitudes.
          </span>
        </div>
      )}
      {total > cartsPerPage ? (
        <nav
          aria-label="Paginación de carritos abandonados"
          className={styles.pagination}
        >
          <span>
            PÁGINA {currentPage} DE {totalPages} / {total} CARRITOS
          </span>
          <div>
            {currentPage > 1 ? (
              <Link href={pageHref({ page: String(currentPage - 1) })}>ANTERIOR</Link>
            ) : null}
            {currentPage < totalPages ? (
              <Link href={pageHref({ page: String(currentPage + 1) })}>SIGUIENTE</Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
