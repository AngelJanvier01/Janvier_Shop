import "dotenv/config";

import { database } from "../../lib/database";
import { productImageQueueRows } from "../../lib/product-images/queue";

const apply = process.argv.includes("--apply");
const expected = process.argv.find((argument) => argument.startsWith("--expect="))?.slice(9);

try {
  const products = await database.product.findMany({
    select: {
      galleryUrls: true,
      id: true,
      imageDerivatives: { select: { sourceUrlHash: true } },
      imageExclusions: { select: { sourceUrlHash: true } },
      imageUrl: true
    },
    where: { status: { not: "ARCHIVED" } }
  });
  const missing = products.flatMap((product) => {
    const existing = new Set(product.imageDerivatives.map((image) => image.sourceUrlHash));
    const excluded = new Set(product.imageExclusions.map((image) => image.sourceUrlHash));
    return productImageQueueRows(product.id, product.imageUrl, product.galleryUrls).filter(
      (image) => !existing.has(image.sourceUrlHash) && !excluded.has(image.sourceUrlHash)
    );
  });
  if (expected !== undefined && Number.parseInt(expected, 10) !== missing.length) {
    throw new Error(`Se esperaban ${expected} imágenes nuevas, pero se encontraron ${missing.length}.`);
  }
  if (apply && expected === undefined) {
    throw new Error("Para aplicar se requiere --expect=<cantidad> obtenida en la simulación.");
  }
  if (apply && missing.length) {
    await database.productImageDerivative.createMany({ data: missing, skipDuplicates: true });
  }
  console.info(JSON.stringify({ apply, missing: missing.length, products: products.length }));
} finally {
  await database.$disconnect();
}
