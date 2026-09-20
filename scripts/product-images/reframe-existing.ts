import "dotenv/config";

import sharp from "sharp";

import { database } from "../../lib/database";
import { normalizeProductImageCanvas } from "../../lib/product-images/processor";
import {
  productImageStorageKey,
  readProductImageVariant,
  writeProductImageVariant
} from "../../lib/product-images/storage";

const apply = process.argv.includes("--apply");
const includeDrafts = process.argv.includes("--all");
const productSlugArgument = process.argv.find((argument) =>
  argument.startsWith("--product-slug=")
);
const productSlug = productSlugArgument?.slice("--product-slug=".length).trim();

const where = {
  product: productSlug
    ? { slug: productSlug }
    : includeDrafts
      ? undefined
      : { status: "PUBLISHED" as const },
  sourceHash: { not: null },
  status: "APPROVED" as const,
  storageKey: { not: null }
};

const scope = productSlug
  ? `PRODUCT:${productSlug}`
  : includeDrafts
    ? "ALL_STORED"
    : "PUBLISHED_ONLY";

try {
  const eligible = await database.productImageDerivative.findMany({
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      processingVersion: true,
      sourceHash: true,
      storageKey: true
    },
    where
  });

  if (!apply) {
    console.info(JSON.stringify({ apply: false, eligible: eligible.length, scope }));
  } else {
    let failed = 0;
    let reframed = 0;

    for (const asset of eligible) {
      try {
        if (!asset.sourceHash || !asset.storageKey) continue;
        const png = await normalizeProductImageCanvas(
          await readProductImageVariant(asset.storageKey, "png")
        );
        const nextVersion = asset.processingVersion + 1;
        const nextStorageKey = productImageStorageKey(
          asset.id,
          asset.sourceHash,
          nextVersion
        );
        const metadata = await sharp(png).metadata();
        const [webp, avif] = await Promise.all([
          sharp(png).webp({ alphaQuality: 100, quality: 88 }).toBuffer(),
          sharp(png).avif({ effort: 6, quality: 72 }).toBuffer()
        ]);
        await Promise.all([
          writeProductImageVariant(nextStorageKey, "png", png),
          writeProductImageVariant(nextStorageKey, "webp", webp),
          writeProductImageVariant(nextStorageKey, "avif", avif)
        ]);
        const updated = await database.productImageDerivative.updateMany({
          data: {
            attempts: 0,
            height: metadata.height ?? null,
            lastErrorCode: null,
            lastErrorMessage: null,
            lockedAt: null,
            lockedBy: null,
            nextAttemptAt: new Date(),
            processedAt: new Date(),
            processingVersion: nextVersion,
            status: "APPROVED",
            storageKey: nextStorageKey,
            width: metadata.width ?? null
          },
          where: {
            id: asset.id,
            processingVersion: asset.processingVersion,
            status: "APPROVED"
          }
        });
        reframed += updated.count;
      } catch (error) {
        failed += 1;
        console.error(
          JSON.stringify({
            assetId: asset.id,
            error: error instanceof Error ? error.message : "REFRAME_FAILED"
          })
        );
      }
    }

    console.info(JSON.stringify({ apply: true, failed, reframed, scope }));
  }
} finally {
  await database.$disconnect();
}
