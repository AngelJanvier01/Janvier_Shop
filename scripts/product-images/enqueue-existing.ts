import "dotenv/config";

import { database } from "../../lib/database";
import { enqueueProductImages } from "../../lib/product-images/queue";

const products = await database.product.findMany({
  select: { galleryUrls: true, id: true, imageUrl: true }
});
let queued = 0;

try {
  for (const product of products) {
    queued += await database.$transaction((transaction) =>
      enqueueProductImages(
        transaction,
        product.id,
        product.imageUrl,
        product.galleryUrls
      )
    );
  }
  console.info(JSON.stringify({ products: products.length, queued }));
} finally {
  await database.$disconnect();
}
