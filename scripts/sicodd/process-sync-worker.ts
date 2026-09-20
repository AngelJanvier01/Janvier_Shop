import "dotenv/config";

import { setTimeout as wait } from "node:timers/promises";

import { database } from "../../lib/database";
import {
  processNextQueuedSicoddSync,
  queueDueScheduledSicoddSync
} from "../../lib/sicodd/sync";

let stopping = false;
process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

const once = process.argv.includes("--once");

try {
  do {
    const scheduled = await queueDueScheduledSicoddSync();
    const result = await processNextQueuedSicoddSync();
    if (scheduled || result) {
      console.info(
        JSON.stringify({ component: "sicodd-sync-worker", result, scheduled })
      );
    }
    if (once) break;
    if (!result) await wait(30_000);
  } while (!stopping);
} finally {
  await database.$disconnect();
}
