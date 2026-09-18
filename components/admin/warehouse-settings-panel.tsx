"use client";

import { useActionState } from "react";

import {
  saveSicoddWarehouse,
  type WarehouseActionState
} from "@/app/(admin)/admin/ajustes/sucursales/actions";
import styles from "@/app/(admin)/admin/ajustes/sucursales/page.module.css";

type WarehouseView = {
  id: string;
  lastSeenLabel: string;
  nickname: string;
  notes: string;
  sourceName: string;
};

const initialState: WarehouseActionState = {};

function WarehouseForm({ warehouse }: { warehouse?: WarehouseView }) {
  const [state, formAction, pending] = useActionState(saveSicoddWarehouse, initialState);

  return (
    <form action={formAction} className={styles.warehouseForm}>
      {warehouse ? <input name="warehouseId" type="hidden" value={warehouse.id} /> : null}
      <div className={styles.sourceIdentity}>
        <span>NOMBRE EN SICODD</span>
        {warehouse ? (
          <code>{warehouse.sourceName}</code>
        ) : (
          <input
            aria-label="Nombre exacto en SICODD"
            name="sourceName"
            placeholder="EJ. DICOTECH AGUASCALIENTES"
            required
          />
        )}
        <small>
          {warehouse
            ? `ÚLTIMA LECTURA: ${warehouse.lastSeenLabel}`
            : "Debe coincidir con la etiqueta que entrega el proveedor."}
        </small>
      </div>
      <label>
        <span>APODO INTERNO</span>
        <input
          defaultValue={warehouse?.nickname ?? ""}
          maxLength={100}
          name="nickname"
          placeholder="EJ. AGUASCALIENTES CENTRO"
          required
        />
      </label>
      <label>
        <span>NOTAS DE LA SUCURSAL</span>
        <textarea
          defaultValue={warehouse?.notes ?? ""}
          maxLength={500}
          name="notes"
          placeholder="Horario, contacto o referencia operativa opcional"
          rows={3}
        />
      </label>
      <div className={styles.formFooter}>
        <p aria-live="polite" data-error={Boolean(state.error)}>
          {state.error ?? state.success ?? " "}
        </p>
        <button disabled={pending} type="submit">
          {pending ? "GUARDANDO…" : warehouse ? "GUARDAR CAMBIOS" : "REGISTRAR SUCURSAL"}
        </button>
      </div>
    </form>
  );
}

export function WarehouseSettingsPanel({ warehouses }: { warehouses: WarehouseView[] }) {
  return (
    <div className={styles.directory}>
      {warehouses.map((warehouse) => (
        <WarehouseForm key={warehouse.id} warehouse={warehouse} />
      ))}
      <details className={styles.newWarehouse} open={!warehouses.length}>
        <summary>REGISTRAR UNA SUCURSAL MANUALMENTE +</summary>
        <WarehouseForm />
      </details>
    </div>
  );
}
