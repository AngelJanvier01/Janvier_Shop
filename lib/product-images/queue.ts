import { createHash } from "node:crypto";

import type { Prisma } from "@/app/generated/prisma/client";
import { getProductSourceGallery } from "@/lib/commerce/catalog";

export function productImageSourceHash(sourceUrl: string) {
  return createHash("sha256").update(sourceUrl).digest("hex");
}

export function productImageQueueRows(
  productId: string,
  imageUrl: string | null,
  galleryUrls: unknown
) {
  return getProductSourceGallery(imageUrl, galleryUrls).map((sourceUrl, sourcePosition) => ({
    productId,
    sourcePosition,
    sourceUrl,
    sourceUrlHash: productImageSourceHash(sourceUrl)
  }));
}

export async function enqueueProductImages(
  transaction: Prisma.TransactionClient,
  productId: string,
  imageUrl: string | null,
  galleryUrls: unknown
) {
  const rows = productImageQueueRows(productId, imageUrl, galleryUrls);
  for (const row of rows) {
    await transaction.productImageDerivative.upsert({
      create: row,
      update: { sourcePosition: row.sourcePosition },
      where: {
        productId_sourceUrlHash: {
          productId,
          sourceUrlHash: row.sourceUrlHash
        }
      }
    });
  }
  return rows.length;
}
