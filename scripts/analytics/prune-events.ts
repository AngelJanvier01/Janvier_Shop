import "dotenv/config";

import { database } from "../../lib/database";

const apply = process.argv.includes("--apply");
const retentionDays = 90;
const before = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
const count = await database.webAnalyticsEvent.count({ where: { createdAt: { lt: before } } });

if (apply && count) {
  await database.webAnalyticsEvent.deleteMany({ where: { createdAt: { lt: before } } });
}

console.log(
  `${apply ? "PRUNED" : "DRY_RUN"} analytics_events=${count} retention_days=${retentionDays}`
);
await database.$disconnect();
