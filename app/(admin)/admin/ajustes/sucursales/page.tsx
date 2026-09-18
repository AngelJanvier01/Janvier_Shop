import Link from "next/link";

import { WarehouseSettingsPanel } from "@/components/admin/warehouse-settings-panel";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = { robots: { index: false }, title: "Sucursales SICODD" };
export const dynamic = "force-dynamic";

function dateLabel(value: Date | null) {
  if (!value) return "AÚN NO VISTA";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  })
    .format(value)
    .toLocaleUpperCase("es-MX");
}

export default async function WarehouseSettingsPage() {
  await requireSettingsAdmin();
  const warehouses = await database.sicoddWarehouse.findMany({
    orderBy: [{ nickname: "asc" }, { sourceName: "asc" }]
  });
  const lastSeenAt = warehouses.reduce<Date | null>(
    (latest, warehouse) =>
      warehouse.lastSeenAt && (!latest || warehouse.lastSeenAt > latest)
        ? warehouse.lastSeenAt
        : latest,
    null
  );

  return (
    <section className={styles.page}>
      <nav aria-label="Secciones de ajustes" className={styles.settingsNav}>
        <Link aria-current="page" href="/admin/ajustes/sucursales">
          SUCURSALES
        </Link>
        <Link href="/admin/ajustes/correo">CORREO Y NOTIFICACIONES</Link>
      </nav>

      <header className={styles.hero}>
        <div>
          <p>AJUSTES / INVENTARIO_PRIVADO</p>
          <h1>Un apodo claro para cada sucursal.</h1>
          <span>
            SICODD conserva el nombre exacto para sincronizar. Tú eliges cómo verlo en
            administración; la tienda pública recibe solamente el total acumulado.
          </span>
        </div>
        <dl>
          <div>
            <dt>SUCURSALES DETECTADAS</dt>
            <dd>{warehouses.length}</dd>
          </div>
          <div>
            <dt>ÚLTIMA LECTURA</dt>
            <dd>{dateLabel(lastSeenAt)}</dd>
          </div>
        </dl>
      </header>

      <WarehouseSettingsPanel
        warehouses={warehouses.map((warehouse) => ({
          id: warehouse.id,
          lastSeenLabel: dateLabel(warehouse.lastSeenAt),
          nickname: warehouse.nickname,
          notes: warehouse.notes ?? "",
          sourceName: warehouse.sourceName
        }))}
      />
    </section>
  );
}
