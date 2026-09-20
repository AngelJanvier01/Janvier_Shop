import { unstable_cache } from "next/cache";

import { database } from "@/lib/database";

export const commerceCatalogCacheTag = "commerce-catalog";

/** Shared public taxonomy changes only when catalog synchronization changes it. */
export const getPublishedCatalogFacets = unstable_cache(
  async () => {
    const catalogScope = { status: "PUBLISHED" as const };
    const [totalProducts, categoryGroups, brandGroups] = await Promise.all([
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
      })
    ]);
    return { brandGroups, categoryGroups, totalProducts };
  },
  ["commerce-catalog-facets-v1"],
  { revalidate: 300, tags: [commerceCatalogCacheTag] }
);

/**
 * Brand facets are contextual: once a customer enters a category or a SICODD
 * subcategory, unrelated brands must not be offered as a possible next filter.
 * The input arguments form part of Next's cache key, so each taxonomy scope
 * remains independently cacheable without mixing their results.
 */
export const getPublishedCatalogBrandFacets = unstable_cache(
  async (category: string, subcategory: string) =>
    database.product.groupBy({
      by: ["brand"],
      where: {
        brand: { not: null },
        category: category || undefined,
        status: "PUBLISHED",
        supplierSubcategory: subcategory ? { is: { code: subcategory } } : undefined
      },
      _count: { _all: true },
      orderBy: { brand: "asc" }
    }),
  ["commerce-catalog-brand-facets-v1"],
  { revalidate: 300, tags: [commerceCatalogCacheTag] }
);
