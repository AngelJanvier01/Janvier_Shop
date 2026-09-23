import "dotenv/config";

import { database } from "../../lib/database";
import { productImageQueueRows } from "../../lib/product-images/queue";

const apply = process.argv.includes("--apply");
const expected = process.argv.find((argument) => argument.startsWith("--expect="))?.slice(9);
const trackRunId = process.argv.find((argument) => argument.startsWith("--track-run="))?.slice(12);

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
  const trackedRun = trackRunId
    ? await database.sicoddSyncRun.findUnique({
        select: { diagnostics: true, id: true, status: true, type: true },
        where: { id: trackRunId }
      })
    : null;
  if (trackRunId && (!trackedRun || trackedRun.status !== "COMPLETED" || trackedRun.type !== "DAILY_SYNC")) {
    throw new Error("--track-run requiere una corrida diaria completada.");
  }
  const runDiagnostics = trackedRun?.diagnostics;
  const diagnostics =
    runDiagnostics && typeof runDiagnostics === "object" && !Array.isArray(runDiagnostics)
      ? runDiagnostics
      : {};
  if (apply && trackedRun && "manualImageBatch" in diagnostics) {
    throw new Error("La corrida ya tiene un lote manual de imágenes registrado.");
  }
  if (apply && missing.length) {
    const createdAt = new Date();
    await database.$transaction(async (transaction) => {
      const result = await transaction.productImageDerivative.createMany({
        data: missing.map((image) => ({ ...image, createdAt })),
        skipDuplicates: true
      });
      if (result.count !== missing.length) {
        throw new Error("Cambió la cola durante la inserción; no se registró el lote.");
      }
      if (trackedRun) {
        await transaction.sicoddSyncRun.update({
          data: {
            diagnostics: {
              ...diagnostics,
              manualImageBatch: { createdAt: createdAt.toISOString(), expected: missing.length }
            }
          },
          where: { id: trackedRun.id }
        });
      }
    });
  }
  console.info(JSON.stringify({ apply, missing: missing.length, products: products.length }));
} finally {
  await database.$disconnect();
}
