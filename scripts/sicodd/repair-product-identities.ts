import "dotenv/config";

import { database } from "../../lib/database";

type MismatchedProduct = {
  id: string;
  sku: string;
  upc: string;
  supplierSourceUrl: string;
};

const apply = process.argv.includes("--apply");
const expected = Number.parseInt(
  process.argv.find((value) => value.startsWith("--expect="))?.slice(9) ?? "-1",
  10
);

try {
  const mismatched = await database.$queryRaw<MismatchedProduct[]>`
    SELECT id, sku, upc, "supplierSourceUrl"
    FROM "Product"
    WHERE status <> 'ARCHIVED'::"ProductStatus"
      AND upc IS NOT NULL
      AND sku <> upc
      AND "supplierSourceUrl" IS NOT NULL
    ORDER BY sku
  `;
  const ids = new Set(mismatched.map((item) => item.id));
  const destinations = mismatched.map((item) => {
    const current = new URL(item.supplierSourceUrl);
    const linkedUpc = decodeURIComponent(
      current.pathname.match(/\/admin\/producto\/ficha\/upc\/([^/]+)$/iu)?.[1] ?? ""
    );
    if (linkedUpc !== item.upc || !/^[A-Z0-9._-]{4,80}$/iu.test(item.sku)) {
      throw new Error(`Identidad inesperada para el producto ${item.id}.`);
    }
    current.pathname = `/admin/producto/ficha/upc/${encodeURIComponent(item.sku)}`;
    return { ...item, originalUrl: current.toString() };
  });
  const existing = await database.product.findMany({
    select: { id: true },
    where: {
      OR: [
        { upc: { in: destinations.map((item) => item.sku) } },
        { supplierSourceUrl: { in: destinations.map((item) => item.originalUrl) } }
      ]
    }
  });
  if (existing.some((item) => !ids.has(item.id))) {
    throw new Error("La reparación colisionaría con un producto ya existente.");
  }
  if (apply && (expected < 0 || expected !== destinations.length)) {
    throw new Error(`Se esperaban ${expected} productos y se hallaron ${destinations.length}.`);
  }
  if (apply) {
    await database.$transaction(async (transaction) => {
      for (const item of destinations) {
        const updated = await transaction.product.updateMany({
          data: {
            supplierDetailsHash: null,
            supplierImagesHash: null,
            supplierLastSyncedAt: null,
            supplierSourceEtag: null,
            supplierSourceKey: item.sku,
            supplierSourceModifiedAt: null,
            supplierSourcePayload: {},
            supplierSourceUrl: item.originalUrl,
            supplierSpecificationsHash: null,
            upc: item.sku
          },
          where: { id: item.id, upc: item.upc }
        });
        if (updated.count !== 1) throw new Error(`El producto ${item.id} cambió durante la reparación.`);
      }
    });
  }
  console.info(JSON.stringify({ apply, count: destinations.length, skus: destinations.map((item) => item.sku) }));
} finally {
  await database.$disconnect();
}
