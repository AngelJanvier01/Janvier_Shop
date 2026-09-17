"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import styles from "./page.module.css";

export type CatalogFilterOption = {
  label: string;
  value: string;
  count: number;
};

export type CatalogFilterValues = {
  availability: string;
  brand: string;
  category: string;
  query: string;
  sort: string;
};

type CatalogFilterPanelProps = {
  activeFilterCount: number;
  brands: CatalogFilterOption[];
  categories: CatalogFilterOption[];
  totalProducts: number;
  values: CatalogFilterValues;
};

type FilterField = "availability" | "brand" | "category" | "query";

const scrollPositionKey = "janvier-catalog-scroll-position";

export function CatalogFilterPanel({
  activeFilterCount,
  brands,
  categories,
  totalProducts,
  values
}: CatalogFilterPanelProps) {
  const pathname = usePathname();
  const [formValues, setFormValues] = useState(values);

  useEffect(() => {
    const storedPosition = window.sessionStorage.getItem(scrollPositionKey);
    if (!storedPosition) return;

    window.sessionStorage.removeItem(scrollPositionKey);
    const position = Number.parseInt(storedPosition, 10);
    const restorePosition = () =>
      window.scrollTo(0, Number.isFinite(position) ? position : 0);
    window.requestAnimationFrame(restorePosition);
    window.setTimeout(restorePosition, 600);
  }, []);

  function updateFilter(field: FilterField, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function saveScrollPosition() {
    window.sessionStorage.setItem(scrollPositionKey, String(window.scrollY));
  }

  function clearFilters() {
    saveScrollPosition();
    window.location.assign(pathname);
  }

  return (
    <form
      action={pathname}
      className={styles.filterPanel}
      method="get"
      onSubmit={saveScrollPosition}
    >
      <div className={styles.filterContent}>
        <div className={styles.filterHeading}>
          <div>
            <p>BUSCADOR TÉCNICO</p>
            <h2>Afina tu búsqueda.</h2>
          </div>
          {activeFilterCount ? <span>{activeFilterCount} ACTIVOS</span> : null}
        </div>

        <label className={styles.searchField}>
          <span>BUSCAR PRODUCTO</span>
          <input
            name="q"
            onChange={(event) => updateFilter("query", event.currentTarget.value)}
            placeholder="SKU, UPC, parte, marca o necesidad"
            type="search"
            value={formValues.query}
          />
          <small>Combina palabras: “MONITOR 24 HDMI” o pega un SKU completo.</small>
        </label>

        <p className={styles.filterHint}>
          Cada criterio se suma a tu búsqueda. Puedes retirar cualquiera desde los filtros
          activos.
        </p>

        <div className={styles.filterGroup}>
          <label>
            <span>CATEGORÍA</span>
            <select
              name="category"
              onChange={(event) => updateFilter("category", event.currentTarget.value)}
              value={formValues.category}
            >
              <option value="">Todas las categorías ({totalProducts})</option>
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>MARCA</span>
            <select
              name="brand"
              onChange={(event) => updateFilter("brand", event.currentTarget.value)}
              value={formValues.brand}
            >
              <option value="">Todas las marcas</option>
              {brands.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className={styles.availability}>
          <legend>TIPO DE SUMINISTRO</legend>
          <label>
            <input
              checked={!formValues.availability}
              name="availability"
              onChange={(event) =>
                updateFilter("availability", event.currentTarget.value)
              }
              type="radio"
              value=""
            />
            <span>TODO EL CATÁLOGO</span>
          </label>
          <label>
            <input
              checked={formValues.availability === "ready"}
              name="availability"
              onChange={(event) =>
                updateFilter("availability", event.currentTarget.value)
              }
              type="radio"
              value="ready"
            />
            <span>DISPONIBILIDAD A VALIDAR</span>
          </label>
          <label>
            <input
              checked={formValues.availability === "special"}
              name="availability"
              onChange={(event) =>
                updateFilter("availability", event.currentTarget.value)
              }
              type="radio"
              value="special"
            />
            <span>BAJO PEDIDO</span>
          </label>
        </fieldset>

        <label className={styles.sortField}>
          <span>ORDENAR</span>
          <select
            name="sort"
            onChange={(event) => {
              const sort = event.currentTarget.value;
              setFormValues((current) => ({ ...current, sort }));
            }}
            value={formValues.sort}
          >
            <option value="name">NOMBRE A–Z</option>
            <option value="recent">ACTUALIZADOS RECIENTEMENTE</option>
            <option value="price-asc">PRECIO: MENOR A MAYOR</option>
            <option value="price-desc">PRECIO: MAYOR A MENOR</option>
          </select>
        </label>
      </div>

      <div className={styles.filterActions}>
        <button type="submit">APLICAR FILTROS</button>
        <button onClick={clearFilters} type="button">
          LIMPIAR
        </button>
      </div>
    </form>
  );
}
