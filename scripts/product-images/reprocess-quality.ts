import "dotenv/config";

import { database } from "../../lib/database";

const apply = process.argv.includes("--apply");
const includeDrafts = process.argv.includes("--all");

const where = {
  product: includeDrafts ? undefined : { status: "PUBLISHED" as const },
  status: "APPROVED" as const,
  storageKey: { not: null }
};

try {
  const eligible = await database.productImageDerivative.count({ where });
  if (!apply) {
    console.info(
      JSON.stringify({
        apply: false,
        eligible,
        scope: includeDrafts ? "ALL_APPROVED" : "PUBLISHED_ONLY"
      })
    );
  } else {
    const updated = await database.productImageDerivative.updateMany({
      data: {
        attempts: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: new Date(),
        processingVersion: { increment: 1 },
        status: "PENDING"
      },
      where
    });
    console.info(
      JSON.stringify({
        apply: true,
        scope: includeDrafts ? "ALL_APPROVED" : "PUBLISHED_ONLY",
        updated: updated.count
      })
    );
  }
} finally {
  await database.$disconnect();
}
