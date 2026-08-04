import "dotenv/config";

import { database } from "../../lib/database";

const apply = process.argv.includes("--apply");
const sentBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
const deadBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000);
const [sent, dead] = await Promise.all([
  database.emailOutbox.count({ where: { sentAt: { lt: sentBefore }, status: "SENT" } }),
  database.emailOutbox.count({ where: { failedAt: { lt: deadBefore }, status: "DEAD" } })
]);

if (apply) {
  await database.$transaction([
    database.emailOutbox.deleteMany({ where: { sentAt: { lt: sentBefore }, status: "SENT" } }),
    database.emailOutbox.deleteMany({ where: { failedAt: { lt: deadBefore }, status: "DEAD" } })
  ]);
}
console.log(JSON.stringify({ dead, mode: apply ? "applied" : "dry-run", sent }));
await database.$disconnect();
