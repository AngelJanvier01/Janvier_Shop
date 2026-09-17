import "dotenv/config";

import { setTimeout as wait } from "node:timers/promises";

import { database } from "../../lib/database";
import { productImageConfiguration } from "../../lib/product-images/config";
import { processPendingProductImages } from "../../lib/product-images/worker";

let stopping = false;
process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

const once = process.argv.includes("--once");
const configuration = productImageConfiguration();
if (!once && !configuration.workerEnabled) {
  throw new Error("PRODUCT_IMAGE_WORKER_ENABLED=true is required for continuous mode.");
}

try {
  do {
    const result = await processPendingProductImages(1);
    if (result.claimed || result.failed || result.ready) {
      console.info(JSON.stringify({ component: "product-image-worker", ...result }));
    }
    if (once) break;
    if (!result.claimed) await wait(5_000);
  } while (!stopping);
} finally {
  await database.$disconnect();
}
