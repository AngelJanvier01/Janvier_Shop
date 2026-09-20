import "dotenv/config";

import { setTimeout as wait } from "node:timers/promises";

import { expireDueSpeiQuotes } from "../../lib/commerce/spei-expiration";
import { database } from "../../lib/database";

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
    const result = await expireDueSpeiQuotes();
    if (result.considered || result.expired) {
      console.info(JSON.stringify({ component: "spei-expiration-worker", ...result }));
    }
    if (once) break;
    await wait(60_000);
  } while (!stopping);
} finally {
  await database.$disconnect();
}
