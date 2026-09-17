import { randomUUID } from "node:crypto";

import type { ProductImageProcessingStatus } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { processProductImage } from "./processor";
import { removeProductImageStorageKey } from "./storage";

type ClaimedImage = {
  attempts: number;
  id: string;
  maxAttempts: number;
  processingVersion: number;
  sourceUrl: string;
  storageKey: string | null;
};

const retryDelays = [60_000, 5 * 60_000, 30 * 60_000];

function nextAttempt(attempts: number) {
  return new Date(
    Date.now() + retryDelays[Math.min(attempts - 1, retryDelays.length - 1)]
  );
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "IMAGE_PROCESSING_FAILED";
  return /^[A-Z0-9_]{3,80}$/u.test(message) ? message : "IMAGE_PROCESSING_FAILED";
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 900)
    : "No fue posible procesar la imagen.";
}

export async function recoverAbandonedProductImages() {
  const abandonedBefore = new Date(Date.now() - 15 * 60_000);
  return database.$executeRaw`
    UPDATE "ProductImageDerivative"
    SET "lastErrorCode" = 'WORKER_TIMEOUT',
        "lastErrorMessage" = 'El worker no confirmó el resultado dentro del tiempo límite.',
        "lockedAt" = NULL,
        "lockedBy" = NULL,
        "nextAttemptAt" = NOW(),
        "status" = CASE
          WHEN "attempts" >= "maxAttempts"
            THEN 'DEAD'::"ProductImageProcessingStatus"
          ELSE 'RETRY'::"ProductImageProcessingStatus"
        END,
        "updatedAt" = NOW()
    WHERE "status" = 'PROCESSING'::"ProductImageProcessingStatus"
      AND "lockedAt" < ${abandonedBefore};
  `;
}

async function claimProductImages(limit: number, workerId: string) {
  return database.$queryRaw<ClaimedImage[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "ProductImageDerivative"
      WHERE "status" IN (
        'PENDING'::"ProductImageProcessingStatus",
        'RETRY'::"ProductImageProcessingStatus"
      )
        AND "nextAttemptAt" <= NOW()
        AND "attempts" < "maxAttempts"
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "ProductImageDerivative" AS image
    SET "attempts" = image."attempts" + 1,
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "status" = 'PROCESSING'::"ProductImageProcessingStatus",
        "updatedAt" = NOW()
    FROM candidates
    WHERE image."id" = candidates."id"
    RETURNING image."id", image."sourceUrl", image."attempts", image."maxAttempts",
      image."processingVersion", image."storageKey";
  `;
}

export async function processPendingProductImages(limit = 1) {
  await recoverAbandonedProductImages();
  const workerId =
    `${process.env.HOSTNAME || "janvier-image"}:${process.pid}:${randomUUID()}`.slice(
      0,
      120
    );
  const claimed = await claimProductImages(limit, workerId);
  let failed = 0;
  let ready = 0;
  let approved = 0;

  for (const image of claimed) {
    try {
      const result = await processProductImage(image);
      const { autoApproved, ...derivative } = result;
      const updated = await database.productImageDerivative.updateMany({
        data: {
          ...derivative,
          lastErrorCode: null,
          lastErrorMessage: null,
          lockedAt: null,
          lockedBy: null,
          processedAt: new Date(),
          reviewedAt: autoApproved ? new Date() : null,
          reviewedById: null,
          status: autoApproved ? "APPROVED" : "READY"
        },
        where: { id: image.id, lockedBy: workerId, status: "PROCESSING" }
      });
      if (autoApproved) approved += updated.count;
      else ready += updated.count;
      if (updated.count && image.storageKey && image.storageKey !== result.storageKey) {
        await removeProductImageStorageKey(image.storageKey).catch(() => undefined);
      }
    } catch (error) {
      const terminal = image.attempts >= image.maxAttempts;
      const status: ProductImageProcessingStatus = terminal ? "DEAD" : "RETRY";
      await database.productImageDerivative.updateMany({
        data: {
          lastErrorCode: errorCode(error),
          lastErrorMessage: errorMessage(error),
          lockedAt: null,
          lockedBy: null,
          nextAttemptAt: terminal ? new Date() : nextAttempt(image.attempts),
          status
        },
        where: { id: image.id, lockedBy: workerId, status: "PROCESSING" }
      });
      failed += 1;
    }
  }

  return { approved, claimed: claimed.length, failed, ready };
}
