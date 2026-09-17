import "dotenv/config";

import { dispatchPendingEmails, synchronizeProposalEventNotifications } from "../../lib/notifications/dispatch";
import { database } from "../../lib/database";

async function main() {
  const synchronized = await synchronizeProposalEventNotifications();
  const delivery = await dispatchPendingEmails();
  console.log(JSON.stringify({ ...delivery, ...synchronized }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
