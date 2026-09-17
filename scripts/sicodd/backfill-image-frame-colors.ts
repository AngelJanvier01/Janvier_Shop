import "dotenv/config";

import { getProductGallery } from "../../lib/commerce/catalog";
import { database } from "../../lib/database";
import { getSicoddImageFrameColors } from "../../lib/sicodd/image-frame-colors";

const concurrentProducts = 4;

function hasArgument(value: string) {
  return process.argv.includes(value);
}

const includeReadyProducts = hasArgument("--all");
const products = await database.product.findMany({
  orderBy: { updatedAt: "asc" },
  select: {
    galleryUrls: true,
    id: true,
    imageFrameColors: true,
    imageUrl: true,
    sku: true
  },
  where: includeReadyProducts ? undefined : { imageFrameColors: null }
});

let updated = 0;
let skipped = 0;
let failed = 0;

for (let start = 0; start < products.length; start += concurrentProducts) {
  const batch = products.slice(start, start + concurrentProducts);
  const results = await Promise.all(
    batch.map(async (product) => {
      const images = getProductGallery(product.imageUrl, product.galleryUrls);
      if (!images.length) return { status: "skipped" as const };

      try {
        const colors = await getSicoddImageFrameColors(images);
        await database.product.update({
          data: { imageFrameColors: colors },
          where: { id: product.id }
        });
        return { status: "updated" as const };
      } catch {
        return { status: "failed" as const };
      }
    })
  );

  for (const result of results) {
    if (result.status === "updated") updated += 1;
    if (result.status === "skipped") skipped += 1;
    if (result.status === "failed") failed += 1;
  }
}

console.log(
  JSON.stringify(
    { failed, includeReadyProducts, processed: products.length, skipped, updated },
    null,
    2
  )
);

await database.$disconnect();
