import { reviewCustomerAccount } from "./actions";

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

export default async function CustomerAccountsPage() {
  const accounts = await database.customerAccount.findMany({
    include: {
      users: { orderBy: { createdAt: "asc" } },
      reviewedBy: { select: { email: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return (
    <section className={styles.page}>
      <header>
        <p>CLIENT_ACCESS / COMMERCIAL_REVIEW</p>
        <h1>Clientes comerciales</h1>
        <span>
          Revisa el correo confirmado, contexto de compra y perfil de cada empresa antes
          de activar sus precios y acceso.
        </span>
      </header>
      <div className={styles.list}>
        {accounts.length ? (
          accounts.map((account) => {
            const owner = account.users.find((user) => user.role === "OWNER");
            return (
              <article key={account.id}>
                <div className={styles.identity}>
                  <span>{labels[account.status]}</span>
                  <h2>{account.companyName}</h2>
                  <p>
                    {account.contactName} · {account.contactRole ?? "SIN CARGO"}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>CORREO</dt>
                    <dd>{owner?.email ?? "SIN CONTACTO"}</dd>
                  </div>
                  <div>
                    <dt>RFC</dt>
                    <dd>{account.taxId ?? "PENDIENTE"}</dd>
                  </div>
                  <div>
                    <dt>VERIFICACIÓN</dt>
                    <dd>{owner?.emailVerifiedAt ? "CONFIRMADA" : "PENDIENTE"}</dd>
                  </div>
                  <div>
                    <dt>VOLUMEN</dt>
                    <dd>{account.purchaseVolume}</dd>
                  </div>
                </dl>
                {account.purchaseIntent ? (
                  <p className={styles.intent}>{account.purchaseIntent}</p>
                ) : null}
                <form action={reviewCustomerAccount} className={styles.actions}>
                  <input name="accountId" type="hidden" value={account.id} />
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
                </form>
              </article>
            );
          })
        ) : (
          <section className={styles.empty}>
            <h2>Aún no hay solicitudes comerciales.</h2>
            <p>Las solicitudes verificadas aparecerán aquí para que decidas su acceso.</p>
          </section>
        )}
      </div>
    </section>
  );
}
