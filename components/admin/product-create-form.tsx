"use client";

import { useActionState } from "react";

import { createCatalogProduct } from "@/app/(admin)/admin/catalogo/actions";

import styles from "./product-create-form.module.css";

export function ProductCreateForm() {
  const [state, formAction, isPending] = useActionState(createCatalogProduct, {});

  return (
    <form action={formAction} className={styles.form}>
      <div>
        <p>CATALOG / VERIFIED_SUPPLY</p>
        <h2>Publica una ficha que ayude a decidir.</h2>
      </div>
      <label>
        <span>NOMBRE</span>
        <input name="name" required type="text" />
      </label>
      <label>
        <span>SKU</span>
        <input name="sku" required type="text" />
      </label>
      <label>
        <span>CATEGORIA</span>
        <input name="category" placeholder="Computacion, Redes..." required type="text" />
      </label>
      <label>
        <span>MARCA</span>
        <input name="brand" type="text" />
      </label>
      <label className={styles.full}>
        <span>DESCRIPCION</span>
        <textarea name="description" required rows={4} />
      </label>
      <label className={styles.full}>
        <span>ESPECIFICACIONES / UNA POR LINEA</span>
        <textarea name="specifications" rows={4} />
      </label>
      <label className={styles.full}>
        <span>URL DE IMAGEN AUTORIZADA / OPCIONAL</span>
        <input name="imageUrl" type="url" />
      </label>
      <label className={styles.select}>
        <span>ESTADO</span>
        <select defaultValue="DRAFT" name="status">
          <option value="DRAFT">Borrador</option>
          <option value="PUBLISHED">Publicar sin precio</option>
        </select>
      </label>
      <label className={styles.special}>
        <input name="specialOrder" type="checkbox" />
        <span>Se surte bajo pedido o requiere validar disponibilidad.</span>
      </label>
      <button disabled={isPending} type="submit">
        {isPending ? "Guardando..." : "Guardar ficha tecnica"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? (
        <p className={styles.success}>
          {state.success}
          {state.slug ? ` /suministro/catalogo/${state.slug}` : ""}
        </p>
      ) : null}
    </form>
  );
}
