import "dotenv/config";

import { setTimeout as wait } from "node:timers/promises";

import { database } from "../../lib/database";
import {
  dispatchPendingEmails,
  synchronizeProposalEventNotifications
} from "../../lib/notifications/dispatch";
import { synchronizeProductImageFailureNotifications } from "../../lib/product-images/failure-notifications";
import {
  synchronizeSicoddImageCompletionNotifications,
  synchronizeSicoddManualImageCompletionNotifications
} from "../../lib/sicodd/notifications";

let stopping = false;
process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

try {
  do {
    try {
      const synchronized = await synchronizeProposalEventNotifications();
      const imageFailures = await synchronizeProductImageFailureNotifications();
      const sicodd = await synchronizeSicoddImageCompletionNotifications();
      const manualImages = await synchronizeSicoddManualImageCompletionNotifications();
      const delivery = await dispatchPendingEmails();
      const queued = synchronized.queued + imageFailures.queued + sicodd.queued + manualImages.queued;
      if (queued || delivery.failed || delivery.recovered || delivery.sent) {
        console.info(
          JSON.stringify({
            component: "email-outbox-worker",
            ...delivery,
            imageFailures: imageFailures.failedImages,
            queued
          })
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          component: "email-outbox-worker",
          message: error instanceof Error ? error.message : "Error desconocido",
          outcome: "iteration-failed"
        })
      );
    }
    if (!stopping) await wait(30_000);
  } while (!stopping);
} finally {
  await database.$disconnect();
}
