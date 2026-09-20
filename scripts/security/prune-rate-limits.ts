import "dotenv/config";

import { database } from "../../lib/database";

const retentionMilliseconds = 48 * 60 * 60 * 1000;

try {
  const result = await database.requestRateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - retentionMilliseconds) } }
  });
  console.log(JSON.stringify({ deleted: result.count, retentionHours: 48 }));
} finally {
  await database.$disconnect();
}
