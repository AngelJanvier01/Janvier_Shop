"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "@/app/(admin)/admin/catalogo/page.module.css";

type CatalogManagementToolbarProps = {
  brand: string;
  category: string;
  images: string;
  perPage: number;
  query: string;
  resultCount: number;
  sort: string;
  status: string;
  stock: string;
};

type CatalogToolbarValues = {
  brand: string;
  category: string;
  images: string;
  perPage: string;
  query: string;
  sort: string;
  status: string;
  stock: string;
};

function getUrl(pathname: string, values: CatalogToolbarValues) {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.brand) params.set("brand", values.brand);
  if (values.category) params.set("category", values.category);
  if (values.status) params.set("status", values.status);
  if (values.images) params.set("images", values.images);
  if (values.stock) params.set("stock", values.stock);
  if (values.sort !== "recent") params.set("sort", values.sort);
  if (values.perPage !== "50") params.set("perPage", values.perPage);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function CatalogManagementToolbar({
  brand,
  category,
  images,
  perPage,
  query,
  resultCount,
  sort,
  status,
  stock
}: CatalogManagementToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const initialValues: CatalogToolbarValues = {
    brand,
    category,
    images,
    perPage: String(perPage),
    query,
    sort,
    status,
    stock
  };
  const [values, setValues] = useState(initialValues);
  const valuesRef = useRef(initialValues);
  const [isPending, startTransition] = useTransition();
  const firstTextRender = useRef(true);
  const navigationTimerRef = useRef<number | null>(null);

  function navigate(nextValues: CatalogToolbarValues) {
    startTransition(() =>
      router.replace(getUrl(pathname, nextValues), { scroll: false })
    );
  }

  function cancelScheduledNavigation() {
    if (navigationTimerRef.current === null) return;
    window.clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = null;
  }

  function scheduleNavigation(nextValues: CatalogToolbarValues, delay: number) {
    cancelScheduledNavigation();
    navigationTimerRef.current = window.setTimeout(() => {
      navigationTimerRef.current = null;
      navigate(nextValues);
    }, delay);
  }

  function updateSelect(
    field: Exclude<keyof CatalogToolbarValues, "brand" | "category" | "query">,
    value: string
  ) {
    const nextValues = { ...valuesRef.current, [field]: value };
    valuesRef.current = nextValues;
    setValues(nextValues);
    // A changing group of filters should result in one server navigation, not one
    // concurrent request per selector. This matters when the catalog is large.
    scheduleNavigation(nextValues, 220);
  }

  function updateText(field: "brand" | "category" | "query", value: string) {
    setValues((current) => {
      const nextValues = { ...current, [field]: value };
      valuesRef.current = nextValues;
      return nextValues;
    });
  }

  useEffect(() => {
    if (firstTextRender.current) {
      firstTextRender.current = false;
      return;
    }

    scheduleNavigation(valuesRef.current, 400);
    return cancelScheduledNavigation;
    // El texto usa espera; los selectores se agrupan en una espera breve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.brand, values.category, values.query]);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  function clear() {
    const nextValues: CatalogToolbarValues = {
      brand: "",
      category: "",
      images: "",
      perPage: "50",
      query: "",
      sort: "recent",
      status: "",
      stock: ""
    };
    cancelScheduledNavigation();
    valuesRef.current = nextValues;
    setValues(nextValues);
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  const hasFilters = Boolean(
    values.query ||
    values.brand ||
    values.category ||
    values.status ||
    values.images ||
    values.stock ||
    values.sort !== "recent" ||
    values.perPage !== "50"
  );

  return (
    <section className={styles.toolbar} aria-label="Buscar y filtrar catálogo">
      <label className={styles.toolbarSearch}>
        <span>BUSCAR</span>
        <input
          onChange={(event) => updateText("query", event.currentTarget.value)}
          placeholder="Nombre, SKU, UPC o número de parte"
          type="search"
          value={values.query}
        />
      </label>
      <label>
        <span>MARCA</span>
        <input
          onChange={(event) => updateText("brand", event.currentTarget.value)}
          placeholder="Ej. ACTECK"
          type="search"
          value={values.brand}
        />
      </label>
      <label>
        <span>CATEGORÍA</span>
        <input
          onChange={(event) => updateText("category", event.currentTarget.value)}
          placeholder="Ej. CÁMARAS"
          type="search"
          value={values.category}
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
      <label>
        <span>EXISTENCIAS</span>
        <select
          onChange={(event) => updateSelect("stock", event.currentTarget.value)}
          value={values.stock}
        >
          <option value="">Todas</option>
          <option value="available">Con disponibilidad</option>
          <option value="zero">En cero</option>
          <option value="unknown">Sin lectura</option>
          <option value="stale">Lectura vencida (+36 h)</option>
        </select>
      </label>
      <label>
        <span>ORDEN</span>
        <select
          onChange={(event) => updateSelect("sort", event.currentTarget.value)}
          value={values.sort}
        >
          <option value="recent">Actualización reciente</option>
          <option value="oldest">Actualización antigua</option>
          <option value="name">Nombre A–Z</option>
          <option value="price-asc">Precio menor a mayor</option>
          <option value="price-desc">Precio mayor a menor</option>
          <option value="stock">Mayor existencia</option>
        </select>
      </label>
      <label>
        <span>POR PÁGINA</span>
        <select
          onChange={(event) => updateSelect("perPage", event.currentTarget.value)}
          value={values.perPage}
        >
          <option value="25">25 fichas</option>
          <option value="50">50 fichas</option>
          <option value="100">100 fichas</option>
        </select>
      </label>
      <div className={styles.toolbarStatus}>
        <span aria-live="polite">
          {isPending ? "ACTUALIZANDO…" : `${resultCount} RESULTADOS`}
        </span>
        {hasFilters ? (
          <button disabled={isPending} onClick={clear} type="button">
            LIMPIAR
          </button>
        ) : null}
      </div>
    </section>
  );
}
