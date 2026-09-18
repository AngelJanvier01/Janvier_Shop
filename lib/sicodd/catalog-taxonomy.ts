import type { SicoddCatalogFamily } from "./catalog-parser";

import { database } from "@/lib/database";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function candidateCatalogCode(value: unknown) {
  const code = asRecord(value)?.catalogCode;
  return typeof code === "string" ? code.trim().toUpperCase().slice(0, 24) : null;
}

export async function saveSicoddCatalogTaxonomy(
  families: SicoddCatalogFamily[],
  analyzedAt = new Date()
) {
  for (const family of families) {
    await database.sicoddCatalogFamily.upsert({
      create: {
        code: family.code,
        lastSeenAt: analyzedAt,
        name: family.name,
        subcategories: {
          create: family.subcategories.map((subcategory) => ({
            code: subcategory.code,
            lastSeenAt: analyzedAt,
            name: subcategory.name
          }))
        }
      },
      update: {
        lastSeenAt: analyzedAt,
        name: family.name,
        subcategories: {
          upsert: family.subcategories.map((subcategory) => ({
            create: {
              code: subcategory.code,
              lastSeenAt: analyzedAt,
              name: subcategory.name
            },
            update: { lastSeenAt: analyzedAt, name: subcategory.name },
            where: { code: subcategory.code }
          }))
        }
      },
      where: { code: family.code }
    });
  }

  const candidates = await database.sicoddImportCandidate.findMany({
    select: { productId: true, sourcePayload: true },
    where: { productId: { not: null } }
  });
  const codes = new Set(
    candidates
      .map((candidate) => candidateCatalogCode(candidate.sourcePayload))
      .filter(Boolean)
  );
  const subcategories = await database.sicoddCatalogSubcategory.findMany({
    select: { code: true, id: true },
    where: { code: { in: [...codes] as string[] } }
  });
  const subcategoryIds = new Map(subcategories.map((item) => [item.code, item.id]));
  const productLinks = candidates.flatMap((candidate) => {
    const code = candidateCatalogCode(candidate.sourcePayload);
    const supplierSubcategoryId = code ? subcategoryIds.get(code) : null;
    return candidate.productId && supplierSubcategoryId
      ? [{ productId: candidate.productId, supplierSubcategoryId }]
      : [];
  });
  if (productLinks.length) {
    await database.$transaction(
      productLinks.map((item) =>
        database.product.update({
          data: { supplierSubcategoryId: item.supplierSubcategoryId },
          where: { id: item.productId }
        })
      )
    );
  }

  return {
    families: families.length,
    linkedProducts: productLinks.length,
    subcategories: families.reduce(
      (total, family) => total + family.subcategories.length,
      0
    )
  };
}
