import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";
import { getEmailConfiguration } from "@/lib/notifications/config";
import { isDeliveryQueueReady } from "@/lib/notifications/delivery-provider";
import { queueAdminEmail, queueAdminEmailSafely } from "@/lib/notifications/outbox";

import { createSicoddNewProductsPdf } from "./new-products-pdf";

type SicoddRunNotification = {
  id: string;
  includeImages: boolean;
  requestedLimit: number | null;
  sequence: number | null;
  startedAt: Date;
  trigger: "MANUAL" | "SCHEDULED";
  type: "CONNECTION_TEST" | "CATALOG_ANALYSIS" | "SAMPLE_CAPTURE" | "DAILY_SYNC";
};

type SicoddSyncTotals = {
  created: number;
  failed: number;
  imagesDetected: number;
  imagesQueued: number;
  imagesSkipped: number;
  scanned: number;
  unchanged: number;
  updated: number;
};

const integer = new Intl.NumberFormat("es-MX");

function runLabel(run: Pick<SicoddRunNotification, "id" | "sequence">) {
  return run.sequence ? `Corrida ${run.sequence}` : `Corrida ${run.id.slice(-8)}`;
}

function adminRunUrl(runId: string) {
  return `${getEmailConfiguration().appUrl}/admin/sincronizacion/${runId}`;
}

function executionLabel(trigger: SicoddRunNotification["trigger"]) {
  return trigger === "SCHEDULED" ? "Programada" : "Manual";
}

export async function queueSicoddSyncStartedNotification(run: SicoddRunNotification) {
  return queueAdminEmailSafely({
    actionLabel: "Ver sincronización",
    actionUrl: adminRunUrl(run.id),
    dedupeKey: `sicodd-sync-started:${run.id}`,
    details: [
      { label: "Corrida", value: runLabel(run) },
      { label: "Ejecución", value: executionLabel(run.trigger) },
      {
        label: "Alcance",
        value: run.requestedLimit
          ? `${integer.format(run.requestedLimit)} artículos como máximo`
          : "Catálogo completo"
      },
      { label: "Imágenes", value: run.includeImages ? "Incluidas" : "Omitidas" }
    ],
    kind: EmailNotificationKind.ADMIN_SICODD_SYNC_STARTED,
    priority: 10,
    sicoddSyncRunId: run.id,
    subject: `JANVIER · Sincronización SICODD iniciada · ${runLabel(run)}`,
    summary:
      "La descarga y actualización del catálogo de SICODD ha comenzado. Recibirás otro correo cuando finalice.",
    title: "Sincronización SICODD iniciada",
    tone: "neutral"
  });
}

export async function queueSicoddSyncCompletedNotification(
  run: SicoddRunNotification,
  totals: SicoddSyncTotals
) {
  const hasNewProducts = totals.created > 0;
  return queueAdminEmailSafely({
    actionLabel: "Revisar resultados",
    actionUrl: adminRunUrl(run.id),
    dedupeKey: `sicodd-sync-completed:${run.id}`,
    details: [
      { label: "Corrida", value: runLabel(run) },
      { label: "Artículos revisados", value: integer.format(totals.scanned) },
      { label: "Artículos nuevos", value: integer.format(totals.created) },
      { label: "Actualizados", value: integer.format(totals.updated) },
      { label: "Sin cambios", value: integer.format(totals.unchanged) },
      { label: "Con error", value: integer.format(totals.failed) },
      { label: "Imágenes encoladas", value: integer.format(totals.imagesQueued) }
    ],
    kind: EmailNotificationKind.ADMIN_SICODD_SYNC_COMPLETED,
    priority: 15,
    sicoddSyncRunId: run.id,
    subject: `JANVIER · Sincronización SICODD terminada · ${totals.created} nuevos`,
    summary: hasNewProducts
      ? `La sincronización terminó y encontró ${integer.format(totals.created)} artículos nuevos. Te avisaremos cuando sus imágenes terminen de procesarse y adjuntaremos el PDF de claves.`
      : "La sincronización terminó correctamente y no encontró artículos nuevos.",
    title: "Sincronización SICODD terminada",
    tone: hasNewProducts ? "signal" : "neutral"
  });
}

export async function queueSicoddSyncFailedNotification(
  run: SicoddRunNotification,
  errorSummary: string
) {
  return queueAdminEmailSafely({
    actionLabel: "Revisar error",
    actionUrl: adminRunUrl(run.id),
    dedupeKey: `sicodd-sync-failed:${run.id}`,
    details: [
      { label: "Corrida", value: runLabel(run) },
      { label: "Ejecución", value: executionLabel(run.trigger) },
      { label: "Error", value: errorSummary }
    ],
    kind: EmailNotificationKind.ADMIN_SICODD_SYNC_FAILED,
    priority: 30,
    sicoddSyncRunId: run.id,
    subject: `JANVIER · Falló la sincronización SICODD · ${runLabel(run)}`,
    summary:
      "La sincronización terminó con un error antes de completar el catálogo. Revisa el detalle de la corrida.",
    title: "Falló la sincronización SICODD",
    tone: "alert"
  });
}

export async function synchronizeSicoddImageCompletionNotifications(limit = 5) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !(await isDeliveryQueueReady())) return { queued: 0 };

  const runs = await database.sicoddSyncRun.findMany({
    orderBy: { finishedAt: "asc" },
    take: limit,
    where: {
      emailOutbox: {
        none: { kind: EmailNotificationKind.ADMIN_SICODD_IMAGE_PROCESSING_COMPLETED }
      },
      finishedAt: { not: null },
      OR: [
        { productRecords: { some: { result: "CREATED" } } },
        { productRecords: { some: { imagesQueued: { gt: 0 } } } }
      ],
      status: "COMPLETED",
      type: "DAILY_SYNC",
      includeImages: true
    }
  });
  let queued = 0;

  for (const run of runs) {
    if (!run.finishedAt) continue;
    const products = await database.product.findMany({
      orderBy: [{ sku: "asc" }, { name: "asc" }],
      select: { createdAt: true, id: true, name: true, partNumber: true, sku: true },
      where: { sicoddSyncRecords: { some: { runId: run.id } } }
    });
    const productIds = products.map((product) => product.id);
    const newProducts = products.filter(
      (product) =>
        product.createdAt >= run.startedAt && product.createdAt <= run.finishedAt!
    );
    const statusGroups = productIds.length
      ? await database.productImageDerivative.groupBy({
          _count: { _all: true },
          by: ["status"],
          where: {
            createdAt: { gte: run.startedAt, lte: run.finishedAt },
            productId: { in: productIds }
          }
        })
      : [];
    const statusCounts = new Map(
      statusGroups.map((group) => [group.status, group._count._all])
    );
    const activeImages =
      (statusCounts.get("PENDING") ?? 0) +
      (statusCounts.get("PROCESSING") ?? 0) +
      (statusCounts.get("RETRY") ?? 0);
    if (activeImages > 0) continue;

    const approved = statusCounts.get("APPROVED") ?? 0;
    const ready = statusCounts.get("READY") ?? 0;
    const rejected = statusCounts.get("REJECTED") ?? 0;
    const dead = statusCounts.get("DEAD") ?? 0;
    const totalImages = [...statusCounts.values()].reduce(
      (total, count) => total + count,
      0
    );
    const attachment = newProducts.length
      ? {
          content: await createSicoddNewProductsPdf({
            finishedAt: run.finishedAt,
            products: newProducts,
            runSequence: run.sequence
          }),
          contentType: "application/pdf",
          filename: `claves-articulos-nuevos-sicodd-${run.sequence ?? run.id}.pdf`
        }
      : undefined;
    const result = await queueAdminEmail({
      actionLabel: "Abrir catálogo",
      actionUrl: `${configuration.appUrl}/admin/catalogo`,
      attachment,
      dedupeKey: `sicodd-images-completed:${run.id}`,
      details: [
        { label: "Corrida", value: runLabel(run) },
        { label: "Artículos nuevos", value: integer.format(newProducts.length) },
        { label: "Imágenes procesadas", value: integer.format(totalImages) },
        { label: "Aprobadas", value: integer.format(approved) },
        { label: "Listas para revisión", value: integer.format(ready) },
        { label: "Rechazadas", value: integer.format(rejected) },
        { label: "Errores definitivos", value: integer.format(dead) }
      ],
      kind: EmailNotificationKind.ADMIN_SICODD_IMAGE_PROCESSING_COMPLETED,
      priority: 20,
      sicoddSyncRunId: run.id,
      subject: newProducts.length
        ? `JANVIER · Imágenes terminadas · ${newProducts.length} artículos nuevos`
        : `JANVIER · Imágenes terminadas · ${runLabel(run)}`,
      summary:
        rejected || dead
          ? newProducts.length
            ? "Terminó el procesamiento de imágenes de los artículos nuevos. Algunas imágenes no pudieron aprobarse; consulta el resumen y el PDF adjunto con las claves."
            : "Terminó el procesamiento de imágenes de la sincronización. Algunas no pudieron aprobarse; consulta el resumen."
          : newProducts.length
            ? "Terminó el procesamiento de imágenes de todos los artículos nuevos. El PDF adjunto contiene sus claves y números de parte."
            : "Terminó el procesamiento de las imágenes detectadas durante esta sincronización.",
      title: "Procesamiento de imágenes terminado",
      tone: rejected || dead ? "alert" : "signal"
    });
    queued += result.queued;
  }

  return { queued };
}

/** A backfill queued after a no-image sync is tracked independently of that run's emails. */
export async function synchronizeSicoddManualImageCompletionNotifications() {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !(await isDeliveryQueueReady())) return { queued: 0 };

  const runs = await database.sicoddSyncRun.findMany({
    orderBy: { finishedAt: "desc" },
    select: { diagnostics: true, finishedAt: true, id: true, sequence: true },
    take: 30,
    where: { finishedAt: { not: null }, status: "COMPLETED", type: "DAILY_SYNC" }
  });
  let queued = 0;

  for (const run of runs) {
    const diagnostics = run.diagnostics;
    if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics)) continue;
    const batch = diagnostics.manualImageBatch;
    if (!batch || typeof batch !== "object" || Array.isArray(batch)) continue;
    const createdAt = batch.createdAt;
    const expected = batch.expected;
    if (
      typeof createdAt !== "string" ||
      typeof expected !== "number" ||
      !Number.isSafeInteger(expected) ||
      expected < 1
    ) continue;
    const batchDate = new Date(createdAt);
    if (Number.isNaN(batchDate.getTime())) continue;
    const dedupeKey = `sicodd-manual-images-completed:${run.id}:${batchDate.toISOString()}`;
    if (await database.emailOutbox.findFirst({ select: { id: true }, where: { dedupeKey: { startsWith: dedupeKey } } })) {
      continue;
    }

    const groups = await database.productImageDerivative.groupBy({
      _count: { _all: true },
      by: ["status"],
      where: { createdAt: batchDate }
    });
    const counts = new Map(groups.map((group) => [group.status, group._count._all]));
    const total = groups.reduce((sum, group) => sum + group._count._all, 0);
    if (
      total !== expected ||
      (counts.get("PENDING") ?? 0) > 0 ||
      (counts.get("PROCESSING") ?? 0) > 0 ||
      (counts.get("RETRY") ?? 0) > 0
    ) continue;

    const newProducts = await database.product.findMany({
      orderBy: { sku: "asc" },
      select: { name: true, partNumber: true, sku: true },
      where: { sicoddSyncRecords: { some: { result: "CREATED", runId: run.id } } }
    });
    const failed = (counts.get("REJECTED") ?? 0) + (counts.get("DEAD") ?? 0);
    const attachment = newProducts.length
      ? {
          content: await createSicoddNewProductsPdf({
            finishedAt: new Date(),
            products: newProducts,
            runSequence: run.sequence
          }),
          contentType: "application/pdf",
          filename: `claves-articulos-nuevos-sicodd-${run.sequence ?? run.id}.pdf`
        }
      : undefined;
    const result = await queueAdminEmail({
      actionLabel: "Revisar catálogo",
      actionUrl: `${configuration.appUrl}/admin/catalogo`,
      attachment,
      dedupeKey,
      details: [
        { label: "Corrida", value: runLabel(run) },
        { label: "Artículos nuevos", value: integer.format(newProducts.length) },
        { label: "Imágenes del lote", value: integer.format(total) },
        { label: "Aprobadas", value: integer.format(counts.get("APPROVED") ?? 0) },
        { label: "Listas para revisión", value: integer.format(counts.get("READY") ?? 0) },
        { label: "Con problemas", value: integer.format(failed) }
      ],
      kind: EmailNotificationKind.ADMIN_SICODD_IMAGE_PROCESSING_COMPLETED,
      priority: 20,
      sicoddSyncRunId: run.id,
      subject: `JANVIER · Terminó el procesamiento de ${integer.format(total)} imágenes`,
      summary: failed
        ? "Terminó el procesamiento del lote de imágenes. Algunas requieren revisión; el PDF adjunto contiene las claves de los artículos nuevos."
        : "Terminó el procesamiento del lote de imágenes. El PDF adjunto contiene las claves de los artículos nuevos.",
      title: "Procesamiento de imágenes terminado",
      tone: failed ? "alert" : "signal"
    });
    queued += result.queued;
  }

  return { queued };
}
