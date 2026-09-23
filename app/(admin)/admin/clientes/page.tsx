import { Prisma } from "@/app/generated/prisma/client";

import { reviewCustomerAccount } from "./actions";

import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Clientes comerciales"
};

const labels = {
  APPROVED: "ACTIVA",
  PENDING_EMAIL: "PENDIENTE DE CORREO",
  PENDING_REVIEW: "PENDIENTE DE REVISIÓN",
  REJECTED: "RECHAZADA",
  SUSPENDED: "SUSPENDIDA"
} as const;

type CustomerAccountsPageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function marginDiagnostics(
  products: Array<{ basePriceWithTax: unknown; supplierCostWithTax: unknown }>,
  commercialDiscountPct: unknown
) {
  const discount = Math.min(Math.max(numberValue(commercialDiscountPct) ?? 0, 0), 100);
  const margins = products.flatMap((product) => {
    const base = numberValue(product.basePriceWithTax);
    const cost = numberValue(product.supplierCostWithTax);
    const sale = base === null ? null : base * (1 - discount / 100);
    return sale !== null && sale > 0 && cost !== null && cost >= 0
      ? [((sale - cost) / sale) * 100]
      : [];
  });
  if (!margins.length) return null;
  return {
    average: margins.reduce((total, margin) => total + margin, 0) / margins.length,
    belowCost: margins.filter((margin) => margin < 0).length,
    count: margins.length,
    minimum: Math.min(...margins)
  };
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "SIN REGISTRO";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  })
    .format(value)
    .toLocaleUpperCase("es-MX");
}

export default async function CustomerAccountsPage({
  searchParams
}: CustomerAccountsPageProps) {
  await requireSettingsAdmin();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const status = Object.hasOwn(labels, params.status ?? "")
    ? (params.status as keyof typeof labels)
    : "";
  const where: Prisma.CustomerAccountWhereInput = {
    status: status || undefined,
    OR: query
      ? [
          { companyName: { contains: query, mode: "insensitive" } },
          { contactName: { contains: query, mode: "insensitive" } },
          { taxId: { contains: query, mode: "insensitive" } },
          { users: { some: { email: { contains: query, mode: "insensitive" } } } }
        ]
      : undefined
  };
  const [accounts, statusCounts, pricedProducts] = await Promise.all([
    database.customerAccount.findMany({
      include: {
        _count: { select: { carts: true, orders: true } },
        enrollmentDocuments: {
          orderBy: { createdAt: "desc" },
          select: { contentType: true, createdAt: true, filename: true, id: true }
        },
        users: { orderBy: { createdAt: "asc" } },
        reviewedBy: { select: { email: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      where
    }),
    database.customerAccount.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    database.product.findMany({
      select: { basePriceWithTax: true, supplierCostWithTax: true },
      where: {
        basePriceWithTax: { gt: 0 },
        status: "PUBLISHED",
        supplierCostWithTax: { not: null }
      }
    })
  ]);
  const counts = new Map(statusCounts.map((entry) => [entry.status, entry._count._all]));
  const totalAccounts = statusCounts.reduce(
    (total, entry) => total + entry._count._all,
    0
  );

  return (
    <section className={styles.page}>
      <header>
        <div>
          <p>CLIENT_ACCESS / COMMERCIAL_REVIEW</p>
          <h1>Clientes comerciales</h1>
          <span>
            Revisa el acceso, la actividad y el margen real que produce cada condición
            comercial.
          </span>
        </div>
        <form className={styles.filters} method="get">
          <label>
            <span>BUSCAR</span>
            <input
              defaultValue={query}
              name="q"
              placeholder="Empresa, contacto, correo o RFC"
              type="search"
            />
          </label>
          <label>
            <span>ESTADO</span>
            <select defaultValue={status} name="status">
              <option value="">Todos</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">FILTRAR</button>
          {query || status ? <a href="/admin/clientes">LIMPIAR</a> : null}
        </form>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>TOTAL</dt>
          <dd>{totalAccounts}</dd>
        </div>
        <div>
          <dt>ACTIVAS</dt>
          <dd>{counts.get("APPROVED") ?? 0}</dd>
        </div>
        <div>
          <dt>POR REVISAR</dt>
          <dd>{counts.get("PENDING_REVIEW") ?? 0}</dd>
        </div>
        <div>
          <dt>SUSPENDIDAS</dt>
          <dd>{counts.get("SUSPENDED") ?? 0}</dd>
        </div>
      </dl>

      <div className={styles.list}>
        {accounts.length ? (
          accounts.map((account) => {
            const owner = account.users.find((user) => user.role === "OWNER");
            const diagnostics = marginDiagnostics(
              pricedProducts,
              account.commercialDiscountPct
            );
            return (
              <article key={account.id}>
                <header className={styles.accountHeader}>
                  <div className={styles.identity}>
                    <span data-status={account.status}>{labels[account.status]}</span>
                    <h2>{account.companyName}</h2>
                    <p>
                      {account.contactName} · {account.contactRole ?? "SIN CARGO"}
                    </p>
                  </div>
                  <nav aria-label={`Acciones rápidas de ${account.companyName}`}>
                    {owner?.email ? <a href={`mailto:${owner.email}`}>CORREO ↗</a> : null}
                    {account.contactPhone ? (
                      <a href={`tel:${account.contactPhone}`}>LLAMAR ↗</a>
                    ) : null}
                  </nav>
                </header>

                <div className={styles.accountBody}>
                  <dl className={styles.accountFacts}>
                    <div>
                      <dt>CORREO</dt>
                      <dd>{owner?.email ?? "SIN CONTACTO"}</dd>
                    </div>
                    <div>
                      <dt>RFC</dt>
                      <dd>{account.taxId ?? "PENDIENTE"}</dd>
                    </div>
                    <div>
                      <dt>FACTURA CFDI</dt>
                      <dd>{account.requiresInvoice ? "REQUERIDA" : "NO REQUERIDA"}</dd>
                    </div>
                    <div>
                      <dt>VERIFICACIÓN</dt>
                      <dd>{owner?.emailVerifiedAt ? "CONFIRMADA" : "PENDIENTE"}</dd>
                    </div>
                    <div>
                      <dt>VOLUMEN</dt>
                      <dd>{account.purchaseVolume}</dd>
                    </div>
                    <div>
                      <dt>ÚLTIMO ACCESO</dt>
                      <dd>{formatDate(owner?.lastLoginAt)}</dd>
                    </div>
                    <div>
                      <dt>PEDIDOS / CARRITOS</dt>
                      <dd>
                        {account._count.orders} / {account._count.carts}
                      </dd>
                    </div>
                    <div>
                      <dt>REVISÓ</dt>
                      <dd>{account.reviewedBy?.email ?? "PENDIENTE"}</dd>
                    </div>
                  </dl>

                  {account.purchaseIntent ? (
                    <p className={styles.intent}>{account.purchaseIntent}</p>
                  ) : null}
                  {account.enrollmentDocuments.length ? (
                    <div className={styles.documents}>
                      <span>DOCUMENTACIÓN RECIBIDA</span>
                      {account.enrollmentDocuments.map((document) => (
                        <a
                          href={`/api/admin/customer-documents/${document.id}`}
                          key={document.id}
                          rel="noreferrer"
                          target="_blank"
                        >
                          VER {document.filename.toUpperCase()}
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <section className={styles.marginAudit}>
                    <div>
                      <span>MARGEN BRUTO ESTIMADO</span>
                      <strong>
                        {diagnostics ? `${diagnostics.average.toFixed(1)}% PROM.` : "—"}
                      </strong>
                    </div>
                    <dl>
                      <div>
                        <dt>MÍNIMO</dt>
                        <dd>
                          {diagnostics ? `${diagnostics.minimum.toFixed(1)}%` : "—"}
                        </dd>
                      </div>
                      <div data-alert={Boolean(diagnostics?.belowCost)}>
                        <dt>BAJO COSTO</dt>
                        <dd>{diagnostics?.belowCost ?? 0}</dd>
                      </div>
                      <div>
                        <dt>ARTÍCULOS VALIDADOS</dt>
                        <dd>{diagnostics?.count ?? 0}</dd>
                      </div>
                    </dl>
                    <p>
                      Cálculo sobre el precio que verá este cliente: precio de lista menos
                      descuento, comparado contra costo SICODD con IVA.
                    </p>
                  </section>
                </div>

                <form action={reviewCustomerAccount} className={styles.actions}>
                  <input name="accountId" type="hidden" value={account.id} />
                  <div className={styles.commercialTerms}>
                    <label>
                      <span>LISTA DE PRECIOS</span>
                      <input
                        defaultValue={account.priceListCode ?? ""}
                        name="priceListCode"
                        placeholder="EJ. MAYOREO / PROYECTOS"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>DESCUENTO SOBRE LISTA / %</span>
                      <input
                        defaultValue={
                          account.commercialDiscountPct === null
                            ? ""
                            : String(account.commercialDiscountPct)
                        }
                        max="100"
                        min="0"
                        name="commercialDiscountPct"
                        placeholder="0"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <label className={styles.termsNotes}>
                      <span>NOTAS INTERNAS</span>
                      <textarea
                        defaultValue={account.reviewNotes ?? ""}
                        name="reviewNotes"
                        placeholder="Condiciones acordadas, documentación o seguimiento..."
                        rows={3}
                      />
                    </label>
                  </div>
                  <div className={styles.decisionButtons}>
                    {account.status === "APPROVED" ? (
                      <button name="decision" type="submit" value="UPDATED">
                        GUARDAR CONDICIÓN
                      </button>
                    ) : null}
                    {account.status !== "APPROVED" ? (
                      <button name="decision" type="submit" value="APPROVED">
                        APROBAR ACCESO
                      </button>
                    ) : null}
                    {account.status !== "REJECTED" ? (
                      <button
                        className={styles.negative}
                        name="decision"
                        type="submit"
                        value="REJECTED"
                      >
                        RECHAZAR
                      </button>
                    ) : null}
                    {account.status === "APPROVED" ? (
                      <button
                        className={styles.negative}
                        name="decision"
                        type="submit"
                        value="SUSPENDED"
                      >
                        SUSPENDER
                      </button>
                    ) : null}
                  </div>
                </form>
              </article>
            );
          })
        ) : (
          <section className={styles.empty}>
            <h2>No hay clientes con estos filtros.</h2>
            <p>Prueba otra búsqueda o limpia los filtros actuales.</p>
          </section>
        )}
      </div>
    </section>
  );
}
