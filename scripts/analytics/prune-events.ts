import "dotenv/config";

import { database } from "../../lib/database";

const apply = process.argv.includes("--apply");
const retentionDays = 90;
const before = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
const [webCount, productCount] = await Promise.all([
  database.webAnalyticsEvent.count({ where: { createdAt: { lt: before } } }),
  database.productEngagementEvent.count({ where: { createdAt: { lt: before } } })
]);

if (apply && (webCount || productCount)) {
  await Promise.all([
    database.webAnalyticsEvent.deleteMany({ where: { createdAt: { lt: before } } }),
    database.productEngagementEvent.deleteMany({ where: { createdAt: { lt: before } } })
  ]);
}

console.log(
  `${apply ? "PRUNED" : "DRY_RUN"} web_analytics_events=${webCount} product_engagement_events=${productCount} retention_days=${retentionDays}`
);
await database.$disconnect();
