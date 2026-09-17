/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type CatalogPageProps = {
  searchParams: Promise<{
    availability?: string;
    brand?: string;
    category?: string;
    q?: string;
    sort?: string;
  }>;
};

type FilterOption = {
  label: string;
  value: string;
  count: number;
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catálogo técnico",
  description:
    "Catálogo de suministro técnico de JANVIER. La disponibilidad y el precio se validan antes de cotizar."
};

function normalizeFilter(value: string | undefined, limit = 80) {
  return value?.trim().slice(0, limit) ?? "";
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function activeFilterCount(filters: {
  availability: string;
  brand: string;
  category: string;
  query: string;
  sort: string;
}) {
  return [
    filters.availability,
    filters.brand,
    filters.category,
    filters.query,
    filters.sort !== "name" ? filters.sort : ""
  ].filter(Boolean).length;
}

function buildCatalogUrl(
  filters: {
    availability: string;
    brand: string;
    category: string;
    query: string;
    sort: string;
  },
  omit?: "availability" | "brand" | "category" | "q" | "sort"
) {
  const params = new URLSearchParams();
  if (filters.query && omit !== "q") params.set("q", filters.query);
  if (filters.category && omit !== "category") params.set("category", filters.category);
  if (filters.brand && omit !== "brand") params.set("brand", filters.brand);
  if (filters.availability && omit !== "availability") {
    params.set("availability", filters.availability);
  }
  if (filters.sort !== "name" && omit !== "sort") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `/suministro/catalogo?${query}` : "/suministro/catalogo";
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const query = normalizeFilter(params.q, 120);
  const selectedCategory = normalizeFilter(params.category);
  const selectedBrand = normalizeFilter(params.brand);
  const availability = ["ready", "special"].includes(params.availability ?? "")
    ? params.availability!
    : "";
  const sort = params.sort === "recent" ? "recent" : "name";

  const filters = {
    availability,
    brand: selectedBrand,
    category: selectedCategory,
    query,
    sort
  };
  const catalogScope = { status: "PUBLISHED" as const };
  const where = {
    ...catalogScope,
    category: selectedCategory || undefined,
    brand: selectedBrand || undefined,
    specialOrder:
      availability === "ready" ? false : availability === "special" ? true : undefined,
    ...(query
      ? {
          OR: [
            { brand: { contains: query, mode: "insensitive" as const } },
            { category: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
            { sku: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [products, totalProducts, categoryGroups, brandGroups, customer] =
    await Promise.all([
      database.product.findMany({
        where,
        orderBy: sort === "recent" ? { updatedAt: "desc" } : [{ name: "asc" }],
        select: {
          brand: true,
          category: true,
          description: true,
          id: true,
          imageUrl: true,
          name: true,
          sku: true,
          slug: true,
          specialOrder: true
        },
        take: 120
      }),
      database.product.count({ where: catalogScope }),
      database.product.groupBy({
        by: ["category"],
        where: catalogScope,
        _count: { _all: true },
        orderBy: { category: "asc" }
      }),
      database.product.groupBy({
        by: ["brand"],
        where: { ...catalogScope, brand: { not: null } },
        _count: { _all: true },
        orderBy: { brand: "asc" }
      }),
      getCurrentCustomer()
    ]);

  const categories: FilterOption[] = categoryGroups.map((item) => ({
    count: item._count._all,
    label: item.category,
    value: item.category
  }));
  const brands: FilterOption[] = brandGroups.flatMap((item) =>
    item.brand?.trim()
      ? [
          {
            count: item._count._all,
            label: item.brand,
            value: item.brand
          }
        ]
      : []
  );
  const appliedFilterCount = activeFilterCount(filters);
  const hasFilters = appliedFilterCount > 0;

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p>SUPPLY_SYSTEM / TECHNICAL_CATALOG</p>
            <h1>Encuentra el equipo correcto.</h1>
            <span>
              Busca por necesidad, marca, SKU o número de parte. Antes de cotizar,
              validamos disponibilidad y condiciones reales.
            </span>
            <div className={styles.heroActions}>
              <Link href={customer ? "/suministro/carrito" : "/suministro/acceso"}>
                {customer ? "MI LISTA DE COTIZACIÓN" : "INGRESAR A MI CUENTA"}
              </Link>
              {!customer ? (
                <Link href="/suministro/registro">SOLICITAR CUENTA</Link>
              ) : null}
            </div>
          </div>
          <dl className={styles.heroSignals}>
            <div>
              <dt>FICHAS PUBLICADAS</dt>
              <dd>{totalProducts}</dd>
            </div>
            <div>
              <dt>CATÁLOGO</dt>
              <dd>{categories.length} FAMILIAS</dd>
            </div>
            <div>
              <dt>PRECIO</dt>
              <dd>VALIDADO AL COTIZAR</dd>
            </div>
          </dl>
        </section>

        <section className={styles.workspace} aria-label="Explorar catálogo técnico">
          <form className={styles.filterPanel} method="get">
            <div className={styles.filterHeading}>
              <div>
                <p>BUSCADOR TÉCNICO</p>
                <h2>Afina tu búsqueda.</h2>
              </div>
              {hasFilters ? <span>{appliedFilterCount} ACTIVOS</span> : null}
            </div>

            <label className={styles.searchField}>
              <span>BUSCAR PRODUCTO</span>
              <input
                defaultValue={query}
                name="q"
                placeholder="SKU, parte, marca o descripción"
                type="search"
              />
            </label>

            <div className={styles.filterGroup}>
              <label>
                <span>CATEGORÍA</span>
                <select defaultValue={selectedCategory} name="category">
                  <option value="">Todas las categorías ({totalProducts})</option>
                  {categories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {upper(item.label)} ({item.count})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>MARCA</span>
                <select defaultValue={selectedBrand} name="brand">
                  <option value="">Todas las marcas</option>
                  {brands.map((item) => (
                    <option key={item.value} value={item.value}>
                      {upper(item.label)} ({item.count})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className={styles.availability}>
              <legend>TIPO DE SUMINISTRO</legend>
              <label>
                <input
                  defaultChecked={!availability}
                  name="availability"
                  type="radio"
                  value=""
                />
                <span>TODO EL CATÁLOGO</span>
              </label>
              <label>
                <input
                  defaultChecked={availability === "ready"}
                  name="availability"
                  type="radio"
                  value="ready"
                />
                <span>DISPONIBILIDAD A VALIDAR</span>
              </label>
              <label>
                <input
                  defaultChecked={availability === "special"}
                  name="availability"
                  type="radio"
                  value="special"
                />
                <span>BAJO PEDIDO</span>
              </label>
            </fieldset>

            <label className={styles.sortField}>
              <span>ORDENAR</span>
              <select defaultValue={sort} name="sort">
                <option value="name">NOMBRE A–Z</option>
                <option value="recent">ACTUALIZADOS RECIENTEMENTE</option>
              </select>
            </label>

            <div className={styles.filterActions}>
              <button type="submit">VER RESULTADOS</button>
              {hasFilters ? (
                <Link href="/suministro/catalogo">LIMPIAR FILTROS</Link>
              ) : null}
            </div>
          </form>

          <div className={styles.results}>
            <header className={styles.resultsHeader}>
              <div>
                <p>
                  RESULTADOS / {products.length}
                  {products.length === 120 ? "+" : ""}
                </p>
                <h2>
                  {hasFilters
                    ? "Selección ajustada a tu búsqueda."
                    : "Empieza con una ficha técnica."}
                </h2>
              </div>
              <span>
                Los precios y existencias se confirman antes de generar una cotización.
              </span>
            </header>

            {hasFilters ? (
              <ul className={styles.activeFilters} aria-label="Filtros activos">
                {query ? (
                  <li>
                    <span>BUSCAR: {upper(query)}</span>
                    <Link
                      aria-label="Quitar búsqueda"
                      href={buildCatalogUrl(filters, "q")}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {selectedCategory ? (
                  <li>
                    <span>{upper(selectedCategory)}</span>
                    <Link
                      aria-label="Quitar categoría"
                      href={buildCatalogUrl(filters, "category")}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {selectedBrand ? (
                  <li>
                    <span>{upper(selectedBrand)}</span>
                    <Link
                      aria-label="Quitar marca"
                      href={buildCatalogUrl(filters, "brand")}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {availability ? (
                  <li>
                    <span>
                      {availability === "special"
                        ? "BAJO PEDIDO"
                        : "DISPONIBILIDAD A VALIDAR"}
                    </span>
                    <Link
                      aria-label="Quitar tipo de suministro"
                      href={buildCatalogUrl(filters, "availability")}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {sort === "recent" ? (
                  <li>
                    <span>ACTUALIZADOS RECIENTEMENTE</span>
                    <Link
                      aria-label="Quitar orden"
                      href={buildCatalogUrl(filters, "sort")}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {products.length ? (
              <div className={styles.grid}>
                {products.map((product) => (
                  <Link href={`/suministro/catalogo/${product.slug}`} key={product.id}>
                    <div className={styles.productImage}>
                      {product.imageUrl ? (
                        <img
                          alt={`Imagen de ${product.name}`}
                          loading="lazy"
                          src={product.imageUrl}
                        />
                      ) : (
                        <span>IMAGEN EN VALIDACIÓN</span>
                      )}
                      <em>{product.specialOrder ? "BAJO PEDIDO" : "FICHA TÉCNICA"}</em>
                    </div>
                    <div className={styles.productCopy}>
                      <span>{upper(product.category)}</span>
                      <h3>{upper(product.name)}</h3>
                      <p>{upper(product.description)}</p>
                    </div>
                    <footer>
                      <b>{upper(product.brand ?? "JANVIER VERIFIED")}</b>
                      <span>SKU {upper(product.sku)}</span>
                      <i aria-hidden="true">↗</i>
                    </footer>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <p>NO HAY COINCIDENCIAS</p>
                <h2>Podemos conseguir lo que estás buscando.</h2>
                <span>
                  Si no aparece en las fichas publicadas, envíanos SKU, número de parte o
                  una breve descripción de tu necesidad.
                </span>
                <div>
                  {hasFilters ? (
                    <Link href="/suministro/catalogo">VER TODO EL CATÁLOGO</Link>
                  ) : null}
                  <Link href="/contacto">SOLICITAR ABASTECIMIENTO</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
