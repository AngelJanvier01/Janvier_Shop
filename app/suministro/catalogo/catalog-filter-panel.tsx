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

function matchesFilterValues(left: CatalogFilterValues, right: CatalogFilterValues) {
  return (
    left.availability === right.availability &&
    left.brand === right.brand &&
    left.category === right.category &&
    left.query === right.query &&
    left.searchSpecifications === right.searchSpecifications &&
    left.sort === right.sort &&
    left.subcategory === right.subcategory
  );
}

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
  const navigationTimerRef = useRef<number | null>(null);
  const pendingValuesRef = useRef<CatalogFilterValues | null>(null);
  const skipNextQueryNavigation = useRef(false);

  const normalizedQuery = formValues.query.trim();
  const queryNeedsMoreCharacters = normalizedQuery.length === 1;
  const subcategoriesReady = formValues.category === values.category;
  const visibleSubcategories = subcategoriesReady ? subcategories : [];
  const brandsReady =
    formValues.category === values.category &&
    formValues.subcategory === values.subcategory;
  const visibleBrands = brandsReady ? brands : [];
  const hasTaxonomyScope = Boolean(formValues.category || formValues.subcategory);
  const subcategoryFamilies = new Set(
    visibleSubcategories.map((item) => item.group).filter(Boolean)
  ).size;

  function navigate(nextValues: CatalogFilterValues) {
    pendingValuesRef.current = nextValues;
    startTransition(() => {
      router.replace(getFilterUrl(pathname, nextValues), { scroll: false });
    });
  }

  function cancelScheduledNavigation() {
    if (navigationTimerRef.current === null) return;
    window.clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = null;
  }

  function scheduleNavigation(nextValues: CatalogFilterValues, delay: number) {
    cancelScheduledNavigation();
    navigationTimerRef.current = window.setTimeout(() => {
      navigationTimerRef.current = null;
      navigate(nextValues);
    }, delay);
  }

  function runQuerySearch() {
    if (queryTimerRef.current !== null) {
      window.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
    }
    cancelScheduledNavigation();
    if (formValuesRef.current.query.trim().length === 1) return;
    navigate(formValuesRef.current);
  }

  function updateFilter(field: FilterField, value: string) {
    const clearsBrandScope = field === "category" || field === "subcategory";
    const nextValues = {
      ...formValuesRef.current,
      [field]: value,
      ...(field === "category" ? { subcategory: "" } : {}),
      ...(clearsBrandScope ? { brand: "" } : {})
    };
    pendingValuesRef.current = nextValues;
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
    // Consolidate rapid selector changes into one route request. Without this,
    // each control creates an expensive concurrent Server Component render.
    scheduleNavigation(nextValues, 220);
  }

  function toggleSpecifications() {
    const nextValues = {
      ...formValuesRef.current,
      searchSpecifications: !formValuesRef.current.searchSpecifications
    };
    pendingValuesRef.current = nextValues;
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
    scheduleNavigation(nextValues, 220);
  }

  useEffect(() => {
    const pendingValues = pendingValuesRef.current;
    if (pendingValues) {
      // A Server Component response from an earlier filter selection must not
      // overwrite newer choices that are still waiting to navigate.
      if (!matchesFilterValues(values, pendingValues)) return;
      pendingValuesRef.current = null;
    }

    const current = formValuesRef.current;
    const keepDraftQuery =
      document.activeElement === queryInputRef.current && current.query !== values.query;
    const nextValues = {
      ...values,
      query: keepDraftQuery ? current.query : values.query
    };
    if (matchesFilterValues(current, nextValues)) return;
    if (current.query !== nextValues.query) skipNextQueryNavigation.current = true;
    formValuesRef.current = nextValues;
    setFormValues(nextValues);
  }, [values]);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

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
    cancelScheduledNavigation();
    if (queryTimerRef.current !== null) {
      window.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
    }
    pendingValuesRef.current = nextValues;
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
            <h2>Filtra el catálogo.</h2>
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
              : "Buscaremos cuando termines de escribir o presiones Enter."}
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
              disabled={!brandsReady}
              onChange={(event) => updateFilter("brand", event.currentTarget.value)}
              value={brandsReady ? formValues.brand : ""}
            >
              <option value="">
                {brandsReady
                  ? hasTaxonomyScope
                    ? `Todas las marcas relacionadas (${visibleBrands.length})`
                    : `Todas las marcas (${visibleBrands.length})`
                  : "Consultando marcas…"}
              </option>
              {visibleBrands.map((item) => (
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
            <span>CON EXISTENCIAS</span>
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
