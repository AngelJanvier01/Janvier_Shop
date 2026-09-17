import "dotenv/config";

import { database } from "../../lib/database";
import { queueDailyOperationsReport } from "../../lib/notifications/reports";

async function main() {
  const result = await queueDailyOperationsReport();
  console.log(JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
