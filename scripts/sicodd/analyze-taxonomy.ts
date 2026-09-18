import "dotenv/config";

import { database } from "../../lib/database";
import { extractSicoddCatalogTaxonomy } from "../../lib/sicodd/catalog-parser";
import { saveSicoddCatalogTaxonomy } from "../../lib/sicodd/catalog-taxonomy";
import { createSicoddClient } from "../../lib/sicodd/client";

const catalogPath = "/admin/producto?clave=MMUSB";

try {
  const client = createSicoddClient();
  await client.signIn();
  const catalog = await client.getHtml(catalogPath);
  const families = extractSicoddCatalogTaxonomy(catalog.html);
  if (!families.length) {
    throw new Error("SICODD no devolvió familias ni subcategorías reconocibles.");
  }

  const analyzedAt = new Date();
  const result = await saveSicoddCatalogTaxonomy(families, analyzedAt);
  await database.sicoddSyncSettings.upsert({
    create: {
      catalogAnalyzedAt: analyzedAt,
      id: "sicodd-primary",
      lastConnectionAt: analyzedAt
    },
    update: {
      catalogAnalyzedAt: analyzedAt,
      lastConnectionAt: analyzedAt,
      lastConnectionError: null
    },
    where: { id: "sicodd-primary" }
  });

  const memory = families.find((family) => family.code === "MM");
  const unclassifiedProducts = await database.product.findMany({
    select: { category: true, sku: true },
    where: { supplierSourceUrl: { not: null }, supplierSubcategoryId: null }
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        memorySubcategories: memory?.subcategories ?? [],
        unclassifiedProducts
      },
      null,
      2
    )
  );
} finally {
  await database.$disconnect();
}
