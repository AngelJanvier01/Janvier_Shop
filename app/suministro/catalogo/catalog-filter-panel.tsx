"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import styles from "./page.module.css";

export type CatalogFilterOption = {
  count: number;
  disabled?: boolean;
  group?: string;
  label: string;
  value: string;
};

export type CatalogFilterValues = {
  availability: string;
  brand: string;
  category: string;
  query: string;
  searchSpecifications: boolean;
  sort: string;
  subcategory: string;
};

type CatalogFilterPanelProps = {
  activeFilterCount: number;
  brands: CatalogFilterOption[];
  categories: CatalogFilterOption[];
  subcategories: CatalogFilterOption[];
  totalProducts: number;
  values: CatalogFilterValues;
};

type FilterField = "availability" | "brand" | "category" | "sort" | "subcategory";

function getFilterUrl(pathname: string, values: CatalogFilterValues) {
  const params = new URLSearchParams();
  if (values.query) params.set("q", values.query);
  if (values.category) params.set("category", values.category);
  if (values.subcategory) params.set("subcategory", values.subcategory);
  if (values.brand) params.set("brand", values.brand);
  if (values.availability) params.set("availability", values.availability);
  if (values.searchSpecifications) params.set("specs", "1");
  if (values.sort !== "name") params.set("sort", values.sort);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function CatalogFilterPanel({
  activeFilterCount,
  brands,
  categories,
  subcategories,
  totalProducts,
  values
}: CatalogFilterPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [formValues, setFormValues] = useState(values);
  const formValuesRef = useRef(values);
  const [isPending, startTransition] = useTransition();
  const firstQueryRender = useRef(true);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const queryTimerRef = useRef<number | null>(null);
  const skipNextQueryNavigation = useRef(false);

  const normalizedQuery = formValues.query.trim();
  const queryNeedsMoreCharacters = normalizedQuery.length === 1;
  const subcategoriesReady = formValues.category === values.category;
  const visibleSubcategories = subcategoriesReady ? subcategories : [];
  const subcategoryFamilies = new Set(
    visibleSubcategories.map((item) => item.group).filter(Boolean)
  ).size;

  function navigate(nextValues: CatalogFilterValues) {
    startTransition(() => {
      router.replace(getFilterUrl(pathname, nextValues), { scroll: false });
    });
  }

  function runQuerySearch() {
    if (queryTimerRef.current !== null) {
      window.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
    }
    if (formValuesRef.current.query.trim().length === 1) return;
    navigate(formValuesRef.current);
  }

  function updateFilter(field: FilterField, value: string) {
    const nextValues = {
      ...formValues,
      [field]: value,
      ...(field === "category" ? { subcategory: "" } : {})
    };
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
    navigate(nextValues);
  }

  function toggleSpecifications() {
    const nextValues = {
      ...formValues,
      searchSpecifications: !formValues.searchSpecifications
    };
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
    navigate(nextValues);
  }

  useEffect(() => {
    const current = formValuesRef.current;
    const keepDraftQuery =
      document.activeElement === queryInputRef.current && current.query !== values.query;
    const nextValues = {
      ...values,
      query: keepDraftQuery ? current.query : values.query
    };
    if (
      current.availability === nextValues.availability &&
      current.brand === nextValues.brand &&
      current.category === nextValues.category &&
      current.query === nextValues.query &&
      current.searchSpecifications === nextValues.searchSpecifications &&
      current.sort === nextValues.sort &&
      current.subcategory === nextValues.subcategory
    ) {
      return;
    }
    if (current.query !== nextValues.query) skipNextQueryNavigation.current = true;
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
  }, [values]);

  useEffect(() => {
    if (firstQueryRender.current) {
      firstQueryRender.current = false;
      return;
    }
    if (skipNextQueryNavigation.current) {
      skipNextQueryNavigation.current = false;
      return;
    }

    if (formValues.query.trim().length === 1) return;

    queryTimerRef.current = window.setTimeout(runQuerySearch, 750);
    return () => {
      if (queryTimerRef.current !== null) {
        window.clearTimeout(queryTimerRef.current);
        queryTimerRef.current = null;
      }
    };
    // Solo la consulta escrita lleva espera; los demás controles navegan al instante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues.query]);

  function clearFilters() {
    const nextValues = {
      availability: "",
      brand: "",
      category: "",
      query: "",
      searchSpecifications: false,
      sort: "name",
      subcategory: ""
    };
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <aside className={styles.filterPanel} aria-label="Filtros del catálogo">
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
            aria-invalid={queryNeedsMoreCharacters}
            maxLength={120}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setFormValues((current) => {
                const nextValues = { ...current, query };
                formValuesRef.current = nextValues;
                return nextValues;
              });
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              runQuerySearch();
            }}
            placeholder="SKU, UPC, parte, marca o necesidad"
            ref={queryInputRef}
            type="search"
            value={formValues.query}
          />
          <small
            className={queryNeedsMoreCharacters ? styles.searchValidation : undefined}
          >
            {queryNeedsMoreCharacters
              ? "Escribe al menos 2 caracteres para buscar."
              : "Escribe con calma; buscaremos al terminar o al presionar Enter."}
          </small>
        </label>

        <button
          aria-checked={formValues.searchSpecifications}
          className={styles.specificationSwitch}
          onClick={toggleSpecifications}
          role="switch"
          type="button"
        >
          <span aria-hidden="true">
            <i />
          </span>
          <strong>BUSCAR EN LAS CARACTERÍSTICAS</strong>
          <small>Incluye especificaciones y datos técnicos.</small>
        </button>

        <div className={styles.filterGroup}>
          <label>
            <span>CATEGORÍA</span>
            <select
              id="catalog-category-filter"
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
          {formValues.category ? (
            <label className={styles.subcategoryReveal}>
              <span>SUBCATEGORÍAS DETECTADAS</span>
              <select
                disabled={!visibleSubcategories.length || !subcategoriesReady}
                id="catalog-subcategory-filter"
                onChange={(event) =>
                  updateFilter("subcategory", event.currentTarget.value)
                }
                value={subcategoriesReady ? formValues.subcategory : ""}
              >
                <option value="">
                  {subcategoriesReady
                    ? visibleSubcategories.length
                      ? `Todas las subcategorías (${visibleSubcategories.length})`
                      : "Sin subcategorías relacionadas"
                    : "Consultando subcategorías…"}
                </option>
                {visibleSubcategories.map((item) => (
                  <option disabled={item.disabled} key={item.value} value={item.value}>
                    {subcategoryFamilies > 1 ? `${item.group} / ` : ""}
                    {item.label} ({item.count || "PENDIENTE"})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>MARCA</span>
            <select
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
            onChange={(event) => updateFilter("sort", event.currentTarget.value)}
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
        <span aria-live="polite" role="status">
          {queryNeedsMoreCharacters
            ? "BÚSQUEDA EN ESPERA"
            : isPending
              ? "ACTUALIZANDO RESULTADOS…"
              : null}
        </span>
        <button
          disabled={!activeFilterCount || isPending}
          onClick={clearFilters}
          type="button"
        >
          LIMPIAR FILTROS
        </button>
      </div>
    </aside>
  );
}
