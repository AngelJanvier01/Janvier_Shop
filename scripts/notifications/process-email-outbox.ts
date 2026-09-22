import "dotenv/config";

import { dispatchPendingEmails, synchronizeProposalEventNotifications } from "../../lib/notifications/dispatch";
import { database } from "../../lib/database";
import { synchronizeProductImageFailureNotifications } from "../../lib/product-images/failure-notifications";
import { synchronizeSicoddImageCompletionNotifications } from "../../lib/sicodd/notifications";

async function main() {
  const synchronized = await synchronizeProposalEventNotifications();
  const imageFailures = await synchronizeProductImageFailureNotifications();
  const sicodd = await synchronizeSicoddImageCompletionNotifications();
  const delivery = await dispatchPendingEmails();
  console.log(
    JSON.stringify({
      ...delivery,
      imageFailures: imageFailures.failedImages,
      queued: synchronized.queued + imageFailures.queued + sicodd.queued
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
