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
