import { createHash } from "node:crypto";

import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";
import { getEmailConfiguration } from "@/lib/notifications/config";
import { queueAdminEmail } from "@/lib/notifications/outbox";

type TerminalProductImageFailure = {
  attempts: number;
  lastErrorCode: string | null;
  product: { name: string; sku: string };
};

export function summarizeTerminalImageFailures(failures: TerminalProductImageFailure[]) {
  const bySku = new Map<
    string,
    { attempts: number; count: number; name: string; reasons: Set<string> }
  >();
  for (const failure of failures) {
    const current = bySku.get(failure.product.sku) ?? {
      attempts: 0,
      count: 0,
      name: failure.product.name,
      reasons: new Set<string>()
    };
    current.attempts = Math.max(current.attempts, failure.attempts);
    current.count += 1;
    current.reasons.add(failure.lastErrorCode || "IMAGE_PROCESSING_FAILED");
    bySku.set(failure.product.sku, current);
  }
  const keys = [...bySku.keys()].sort((left, right) =>
    left.localeCompare(right, "es-MX")
  );
  return {
    details: keys.map((sku) => {
      const failure = bySku.get(sku)!;
      return {
        label: sku,
        value: `${failure.name.slice(0, 120)} · ${failure.count} imagen(es) · ${failure.attempts} intentos · ${[...failure.reasons].sort().join(", ")}`
      };
    }),
    keys
  };
}

export async function synchronizeProductImageFailureNotifications(limit = 50) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !configuration.alertRecipients.length) {
    return { failedImages: 0, keys: 0, marked: 0, queued: 0 };
  }
  const failures = await database.productImageDerivative.findMany({
    orderBy: { updatedAt: "asc" },
    select: {
      attempts: true,
      id: true,
      lastErrorCode: true,
      product: { select: { name: true, sku: true } }
    },
    take: limit,
    where: { failureNotifiedAt: null, status: "DEAD" }
  });
  if (!failures.length) return { failedImages: 0, keys: 0, marked: 0, queued: 0 };

  const summary = summarizeTerminalImageFailures(failures);
  const digest = createHash("sha256")
    .update(
      failures
        .map((failure) => failure.id)
        .sort()
        .join(":")
    )
    .digest("hex")
    .slice(0, 24);
  const dedupeKey = `product-image-terminal-failures:${digest}`;
  const result = await queueAdminEmail({
    actionLabel: "Revisar imágenes de catálogo",
    actionUrl: `${configuration.appUrl}/admin/catalogo?images=processing`,
    dedupeKey,
    details: [
      { label: "Claves afectadas", value: String(summary.keys.length) },
      { label: "Imágenes sin procesar", value: String(failures.length) },
      ...summary.details
    ],
    kind: EmailNotificationKind.ADMIN_PRODUCT_IMAGE_PIPELINE_ALERT,
    priority: 70,
    subject: `JANVIER · ${summary.keys.length} clave(s) sin imagen después de 5 intentos`,
    summary:
      "Estas imágenes agotaron sus cinco intentos automáticos y quedaron detenidas para revisión. Las claves y causas se muestran a continuación.",
    title: "Imágenes que no pudieron procesarse",
    tone: "alert"
  });
  const persisted =
    result.queued > 0 ||
    (await database.emailOutbox.count({
      where: { dedupeKey: { startsWith: `${dedupeKey}:` } }
    })) > 0;
  if (!persisted) {
    return {
      failedImages: failures.length,
      keys: summary.keys.length,
      marked: 0,
      queued: result.queued
    };
  }
  const marked = await database.productImageDerivative.updateMany({
    data: { failureNotifiedAt: new Date() },
    where: {
      failureNotifiedAt: null,
      id: { in: failures.map((failure) => failure.id) },
      status: "DEAD"
    }
  });
  return {
    failedImages: failures.length,
    keys: summary.keys.length,
    marked: marked.count,
    queued: result.queued
  };
}
