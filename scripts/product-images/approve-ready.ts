import "dotenv/config";

import { database } from "../../lib/database";
import { inspectProductImageQuality } from "../../lib/product-images/quality";
import { readProductImageVariant } from "../../lib/product-images/storage";

const apply = process.argv.includes("--apply");
const batchSize = 100;

type Totals = {
  approved: number;
  failed: number;
  inspected: number;
  review: number;
};

async function main() {
  const totals: Totals = { approved: 0, failed: 0, inspected: 0, review: 0 };
  let cursor: string | undefined;

  while (true) {
    const assets = await database.productImageDerivative.findMany({
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      select: { id: true, storageKey: true },
      skip: cursor ? 1 : 0,
      take: batchSize,
      where: { status: "READY", storageKey: { not: null } }
    });
    if (!assets.length) break;
    cursor = assets.at(-1)?.id;

    for (const asset of assets) {
      totals.inspected += 1;
      try {
        const quality = await inspectProductImageQuality(
          await readProductImageVariant(asset.storageKey!, "png")
        );
        if (!quality.autoApproved) {
          totals.review += 1;
          if (apply) {
            await database.productImageDerivative.updateMany({
              data: {
                lastErrorCode: "QUALITY_REVIEW",
                lastErrorMessage: quality.message
              },
              where: { id: asset.id, status: "READY" }
            });
          }
          continue;
        }
        totals.approved += 1;
        if (apply) {
          await database.productImageDerivative.updateMany({
            data: {
              lastErrorCode: null,
              lastErrorMessage: null,
              reviewedAt: new Date(),
              reviewedById: null,
              status: "APPROVED"
            },
            where: { id: asset.id, status: "READY" }
          });
        }
      } catch (error) {
        totals.failed += 1;
        if (apply) {
          await database.productImageDerivative.updateMany({
            data: {
              lastErrorCode: "LOCAL_VARIANT_UNAVAILABLE",
              lastErrorMessage:
                error instanceof Error
                  ? error.message.slice(0, 900)
                  : "No fue posible leer el derivado local."
            },
            where: { id: asset.id, status: "READY" }
          });
        }
      }
    }
  }

  console.log(JSON.stringify({ apply, ...totals }));
}

try {
  await main();
} finally {
  await database.$disconnect();
}
