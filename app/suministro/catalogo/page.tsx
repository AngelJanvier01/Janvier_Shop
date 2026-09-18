import { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import { CatalogFilterPanel, type CatalogFilterValues } from "./catalog-filter-panel";
import { CatalogProductCard } from "./catalog-product-card";
import { SupplySubheader } from "@/components/commerce/supply-subheader";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { getProductGallery, getProductImageFrameColors } from "@/lib/commerce/catalog";
import { getSpanishSearchVariants } from "@/lib/commerce/spanish-search";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type CatalogPageProps = {
  searchParams: Promise<{
    availability?: string;
    brand?: string;
    category?: string;
    page?: string;
    q?: string;
    specs?: string;
    sort?: string;
    subcategory?: string;
  }>;
};

type FilterOption = {
  label: string;
  value: string;
  count: number;
};

type CatalogSort = "name" | "price-asc" | "price-desc" | "recent";
type FilterKey =
  "availability" | "brand" | "category" | "q" | "specs" | "sort" | "subcategory";

const pageSize = 25;

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catálogo técnico",
  description:
    "Catálogo de suministro técnico de JANVIER. La disponibilidad y el precio se validan antes de cotizar."
};

function normalizeFilter(value: string | undefined, limit = 80) {
  return value?.trim().slice(0, limit) ?? "";
}

function normalizePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeSort(value: string | undefined): CatalogSort {
  return ["name", "recent", "price-asc", "price-desc"].includes(value ?? "")
    ? (value as CatalogSort)
    : "name";
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function getSearchTokenGroups(query: string) {
  return [
    ...new Set(
      query
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .slice(0, 8)
    )
  ]
    .map(getSpanishSearchVariants)
    .filter((variants) => variants.length);
}

function activeFilterCount(filters: CatalogFilterValues) {
  return [
    filters.availability,
    filters.brand,
    filters.category,
    filters.subcategory,
    filters.query,
    filters.searchSpecifications ? "specs" : "",
    filters.sort !== "name" ? filters.sort : ""
  ].filter(Boolean).length;
}

function getOrderBy(sort: CatalogSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "recent":
      return [{ updatedAt: "desc" }, { name: "asc" }];
    case "price-asc":
      return [{ basePriceWithTax: { nulls: "last", sort: "asc" } }, { name: "asc" }];
    case "price-desc":
      return [{ basePriceWithTax: { nulls: "last", sort: "desc" } }, { name: "asc" }];
    default:
      return [{ name: "asc" }];
  }
}

function buildCatalogUrl(filters: CatalogFilterValues, page = 1, omit?: FilterKey) {
  const params = new URLSearchParams();
  if (filters.query && omit !== "q") params.set("q", filters.query);
  if (filters.category && omit !== "category") params.set("category", filters.category);
  if (filters.subcategory && omit !== "subcategory") {
    params.set("subcategory", filters.subcategory);
  }
  if (filters.brand && omit !== "brand") params.set("brand", filters.brand);
  if (filters.availability && omit !== "availability") {
    params.set("availability", filters.availability);
  }
  if (filters.searchSpecifications && omit !== "specs") params.set("specs", "1");
  if (filters.sort !== "name" && omit !== "sort") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/suministro/catalogo?${query}` : "/suministro/catalogo";
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const candidates = new Set([
    1,
    2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    totalPages - 1,
    totalPages
  ]);
  const pages = [...candidates]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  return pages.flatMap((page, index) => {
    const previous = pages[index - 1];
    return previous && page - previous > 1 ? ["ellipsis" as const, page] : [page];
  });
}

function Pagination({
  currentPage,
  filters,
  totalPages
}: {
  currentPage: number;
  filters: CatalogFilterValues;
  totalPages: number;
}) {
  if (totalPages < 2) return null;

  return (
    <nav aria-label="Paginación del catálogo" className={styles.pagination}>
      {currentPage > 1 ? (
        <Link href={buildCatalogUrl(filters, currentPage - 1)} scroll={false}>
          ANTERIOR
        </Link>
      ) : (
        <span aria-disabled="true">ANTERIOR</span>
      )}
      <ol>
        {getPaginationItems(currentPage, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <li
              aria-hidden="true"
              className={styles.paginationEllipsis}
              key={`ellipsis-${index}`}
            >
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                aria-current={item === currentPage ? "page" : undefined}
                href={buildCatalogUrl(filters, item)}
                scroll={false}
              >
                {item}
              </Link>
            </li>
          )
        )}
      </ol>
      {currentPage < totalPages ? (
        <Link href={buildCatalogUrl(filters, currentPage + 1)} scroll={false}>
          SIGUIENTE
        </Link>
      ) : (
        <span aria-disabled="true">SIGUIENTE</span>
      )}
    </nav>
  );
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const query = normalizeFilter(params.q, 120);
  const selectedCategory = normalizeFilter(params.category);
  const selectedBrand = normalizeFilter(params.brand);
  const selectedSubcategory = normalizeFilter(params.subcategory, 24).toUpperCase();
  const availability = ["ready", "special"].includes(params.availability ?? "")
    ? params.availability!
    : "";
  const sort = normalizeSort(params.sort);
  const searchSpecifications = params.specs === "1";
  const requestedPage = normalizePage(params.page);
  const filters: CatalogFilterValues = {
    availability,
    brand: selectedBrand,
    category: selectedCategory,
    query,
    searchSpecifications,
    sort,
    subcategory: selectedSubcategory
  };
  const searchTokenGroups = getSearchTokenGroups(query);
  const searchRowsPromise = searchTokenGroups.length
    ? database.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "Product"
        WHERE "status"::text = 'PUBLISHED'
          AND ${Prisma.join(
            searchTokenGroups.map(
              (variants) => Prisma.sql`(
              ${Prisma.join(
                variants.map((term) => {
                  const pattern = `%${term}%`;
                  return Prisma.sql`(
                    COALESCE("brand", '') ILIKE ${pattern}
                    OR COALESCE("category", '') ILIKE ${pattern}
                    OR COALESCE("description", '') ILIKE ${pattern}
                    OR COALESCE("name", '') ILIKE ${pattern}
                    OR COALESCE("partNumber", '') ILIKE ${pattern}
                    OR COALESCE("sku", '') ILIKE ${pattern}
                    OR COALESCE("upc", '') ILIKE ${pattern}
                    ${
                      searchSpecifications
                        ? Prisma.sql`OR COALESCE("specifications"::text, '') ILIKE ${pattern}`
                        : Prisma.empty
                    }
                  )`;
                }),
                " OR "
              )}
            )`
            ),
            " AND "
          )}
      `)
    : Promise.resolve([] as { id: string }[]);
  const relatedFamiliesPromise = selectedCategory
    ? database.sicoddCatalogFamily.findMany({
        select: { id: true },
        where: {
          OR: [
            { name: { contains: selectedCategory, mode: "insensitive" } },
            {
              subcategories: {
                some: { products: { some: { category: selectedCategory } } }
              }
            }
          ]
        }
      })
    : Promise.resolve([] as { id: string }[]);
  const [searchRows, relatedFamilies] = await Promise.all([
    searchRowsPromise,
    relatedFamiliesPromise
  ]);
  const relatedFamilyIds = relatedFamilies.map((family) => family.id);
  const catalogScope = { status: "PUBLISHED" as const };
  const where: Prisma.ProductWhereInput = {
    ...catalogScope,
    category: selectedCategory || undefined,
    brand: selectedBrand || undefined,
    supplierSubcategory: selectedSubcategory
      ? { is: { code: selectedSubcategory } }
      : undefined,
    specialOrder:
      availability === "ready" ? false : availability === "special" ? true : undefined,
    id: searchTokenGroups.length ? { in: searchRows.map((row) => row.id) } : undefined
  };

  const [
    filteredProducts,
    totalProducts,
    categoryGroups,
    brandGroups,
    subcategoryGroups,
    customer
  ] = await Promise.all([
    database.product.count({ where }),
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
    relatedFamilyIds.length
      ? database.sicoddCatalogSubcategory.findMany({
          orderBy: [{ family: { name: "asc" } }, { name: "asc" }],
          select: {
            _count: {
              select: {
                products: {
                  where: { category: selectedCategory, status: "PUBLISHED" }
                }
              }
            },
            code: true,
            family: { select: { name: true } },
            name: true
          },
          where: { familyId: { in: relatedFamilyIds } }
        })
      : Promise.resolve(
          [] as Array<{
            _count: { products: number };
            code: string;
            family: { name: string };
            name: string;
          }>
        ),
    getCurrentCustomer()
  ]);

  const activeCart = customer
    ? await database.commerceCart.findFirst({
        select: { _count: { select: { items: true } } },
        where: { accountId: customer.accountId, status: "ACTIVE" }
      })
    : null;

  const totalPages = Math.max(1, Math.ceil(filteredProducts / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const products = await database.product.findMany({
    orderBy: getOrderBy(sort),
    select: {
      brand: true,
      category: true,
      description: true,
      imageFrameColors: true,
      imageDerivatives: {
        orderBy: { sourcePosition: "asc" as const },
        select: { id: true, processingVersion: true, sourceUrl: true },
        where: { status: "APPROVED" as const }
      },
      galleryUrls: true,
      id: true,
      imageUrl: true,
      name: true,
      partNumber: true,
      sku: true,
      slug: true,
      specialOrder: true,
      stockTotal: true,
      upc: true,
      warrantyYears: true
    },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    where
  });
  const categories: FilterOption[] = categoryGroups.map((item) => ({
    count: item._count._all,
    label: upper(item.category),
    value: item.category
  }));
  const brands: FilterOption[] = brandGroups.flatMap((item) =>
    item.brand?.trim()
      ? [
          {
            count: item._count._all,
            label: upper(item.brand),
            value: item.brand
          }
        ]
      : []
  );
  const subcategories: FilterOption[] = subcategoryGroups.map((item) => ({
    count: item._count.products,
    disabled: item._count.products === 0,
    group: upper(item.family.name),
    label: upper(item.name),
    value: item.code
  }));
  const appliedFilterCount = activeFilterCount(filters);
  const hasFilters = appliedFilterCount > 0;

  return (
    <>
      <SiteHeader />
      <SupplySubheader
        cartItemCount={activeCart?._count.items ?? 0}
        companyName={customer?.account.companyName}
        customerName={customer?.name}
      />
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
              <dt>PRODUCTOS DISPONIBLES</dt>
              <dd>{totalProducts}</dd>
            </div>
            <div>
              <dt>CATEGORÍAS</dt>
              <dd>{categories.length}</dd>
            </div>
            <div>
              <dt>MARCAS</dt>
              <dd>{brands.length}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.workspace} aria-label="Explorar catálogo técnico">
          <CatalogFilterPanel
            activeFilterCount={appliedFilterCount}
            brands={brands}
            categories={categories}
            subcategories={subcategories}
            totalProducts={totalProducts}
            values={filters}
          />

          <div className={styles.results}>
            <header className={styles.resultsHeader}>
              <div>
                <p>RESULTADOS / {filteredProducts}</p>
                <h2>
                  {hasFilters
                    ? "Selección ajustada a tu búsqueda."
                    : "Compara opciones con información técnica clara."}
                </h2>
              </div>
              <span>
                {filteredProducts
                  ? `MOSTRANDO ${products.length} DE ${filteredProducts} / PÁGINA ${currentPage} DE ${totalPages}`
                  : "Los precios y existencias se confirman antes de generar una cotización."}
              </span>
            </header>

            {hasFilters ? (
              <ul className={styles.activeFilters} aria-label="Filtros activos">
                {query ? (
                  <li>
                    <span>BUSCAR: {upper(query)}</span>
                    <Link
                      aria-label="Quitar búsqueda"
                      href={buildCatalogUrl(filters, 1, "q")}
                      scroll={false}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {searchSpecifications ? (
                  <li>
                    <span>CARACTERÍSTICAS INCLUIDAS</span>
                    <Link
                      aria-label="Dejar de buscar en características"
                      href={buildCatalogUrl(filters, 1, "specs")}
                      scroll={false}
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
                      href={buildCatalogUrl(filters, 1, "category")}
                      scroll={false}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {selectedSubcategory ? (
                  <li>
                    <span>
                      {upper(
                        subcategories.find((item) => item.value === selectedSubcategory)
                          ?.label ?? selectedSubcategory
                      )}
                    </span>
                    <Link
                      aria-label="Quitar subcategoría"
                      href={buildCatalogUrl(filters, 1, "subcategory")}
                      scroll={false}
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
                      href={buildCatalogUrl(filters, 1, "brand")}
                      scroll={false}
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
                      href={buildCatalogUrl(filters, 1, "availability")}
                      scroll={false}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
                {sort !== "name" ? (
                  <li>
                    <span>
                      {sort === "recent"
                        ? "ACTUALIZADOS RECIENTEMENTE"
                        : sort === "price-asc"
                          ? "PRECIO: MENOR A MAYOR"
                          : "PRECIO: MAYOR A MENOR"}
                    </span>
                    <Link
                      aria-label="Quitar orden"
                      href={buildCatalogUrl(filters, 1, "sort")}
                      scroll={false}
                    >
                      ×
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {products.length ? (
              <>
                <div className={styles.grid}>
                  {products.map((product) => (
                    <CatalogProductCard
                      frameColors={getProductImageFrameColors(
                        product.imageUrl,
                        product.galleryUrls,
                        product.imageFrameColors
                      )}
                      images={getProductGallery(
                        product.imageUrl,
                        product.galleryUrls,
                        product.imageDerivatives
                      )}
                      key={product.id}
                      product={product}
                    />
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  filters={filters}
                  totalPages={totalPages}
                />
              </>
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
                    <Link href="/suministro/catalogo" scroll={false}>
                      VER TODO EL CATÁLOGO
                    </Link>
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
