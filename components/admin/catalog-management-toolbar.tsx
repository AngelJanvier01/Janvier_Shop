"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "@/app/(admin)/admin/catalogo/page.module.css";

type CatalogManagementToolbarProps = {
  images: string;
  query: string;
  resultCount: number;
  status: string;
};

function getUrl(pathname: string, values: { images: string; query: string; status: string }) {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.status) params.set("status", values.status);
  if (values.images) params.set("images", values.images);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function CatalogManagementToolbar({
  images,
  query,
  resultCount,
  status
}: CatalogManagementToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [values, setValues] = useState({ images, query, status });
  const valuesRef = useRef({ images, query, status });
  const [isPending, startTransition] = useTransition();
  const firstQueryRender = useRef(true);

  function navigate(nextValues: typeof values) {
    startTransition(() => router.replace(getUrl(pathname, nextValues), { scroll: false }));
  }

  function updateSelect(field: "images" | "status", value: string) {
    const nextValues = { ...values, [field]: value };
    valuesRef.current = nextValues;
    setValues(nextValues);
    navigate(nextValues);
  }

  useEffect(() => {
    if (firstQueryRender.current) {
      firstQueryRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => navigate(valuesRef.current), 350);
    return () => window.clearTimeout(timeout);
    // Solo el texto usa espera; los selectores actualizan inmediatamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.query]);

  function clear() {
    const nextValues = { images: "", query: "", status: "" };
    valuesRef.current = nextValues;
    setValues(nextValues);
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  const hasFilters = Boolean(values.query || values.status || values.images);

  return (
    <section className={styles.toolbar} aria-label="Buscar y filtrar catálogo">
      <label className={styles.toolbarSearch}>
        <span>BUSCAR</span>
        <input
          onChange={(event) => {
            const query = event.currentTarget.value;
            setValues((current) => {
              const nextValues = { ...current, query };
              valuesRef.current = nextValues;
              return nextValues;
            });
          }}
          placeholder="Nombre, SKU, marca o categoría"
          type="search"
          value={values.query}
        />
      </label>
      <label>
        <span>ESTADO</span>
        <select
          onChange={(event) => updateSelect("status", event.currentTarget.value)}
          value={values.status}
        >
          <option value="">Todos</option>
          <option value="PUBLISHED">Publicados</option>
          <option value="DRAFT">Borradores</option>
          <option value="ARCHIVED">Archivados</option>
        </select>
      </label>
      <label>
        <span>IMÁGENES</span>
        <select
          onChange={(event) => updateSelect("images", event.currentTarget.value)}
          value={values.images}
        >
          <option value="">Cualquier estado</option>
          <option value="ready">Listas para revisión</option>
          <option value="processing">En proceso</option>
          <option value="issues">Con incidencias</option>
        </select>
      </label>
      <div className={styles.toolbarStatus}>
        <span aria-live="polite">{isPending ? "ACTUALIZANDO…" : `${resultCount} RESULTADOS`}</span>
        {hasFilters ? (
          <button disabled={isPending} onClick={clear} type="button">
            LIMPIAR
          </button>
        ) : null}
      </div>
    </section>
  );
}
