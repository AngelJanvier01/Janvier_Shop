import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";

import { Prisma } from "@/app/generated/prisma/client";
import { commerceCatalogCacheTag } from "@/lib/commerce/catalog-facets";
import { database } from "@/lib/database";
import { enqueueProductImages, productImageSourceHash } from "@/lib/product-images/queue";
import {
  extractProductEntries,
  extractSicoddCatalogTaxonomy,
  parseSicoddProductPage,
  type SicoddProductCandidate,
  type SicoddProductLink
} from "@/lib/sicodd/catalog-parser";
import { saveSicoddCatalogTaxonomy } from "@/lib/sicodd/catalog-taxonomy";
import { createSicoddClient } from "@/lib/sicodd/client";
import {
  queueSicoddSyncCompletedNotification,
  queueSicoddSyncFailedNotification,
  queueSicoddSyncStartedNotification
} from "@/lib/sicodd/notifications";
import {
  decimalText,
  sameDecimal,
  sicoddContentHash,
  uniqueSupplierImageUrls,
  withoutExcludedSupplierImages
} from "@/lib/sicodd/sync-fingerprints";
import {
  prepareSicoddStockLocations,
  sicoddStockTotal
} from "@/lib/sicodd/stock-locations";
import { recordSicoddWarehouses } from "@/lib/sicodd/warehouse-directory";

export const primarySicoddSettingsId = "sicodd-primary";

export type SicoddSyncScope = {
  updateCategories: boolean;
  updateCosts: boolean;
  updateDescriptions: boolean;
  updateImages: boolean;
  updatePrices: boolean;
  updateSpecifications: boolean;
  updateStock: boolean;
};

export const defaultSicoddSyncScope: SicoddSyncScope = {
  updateCategories: true,
  updateCosts: true,
  updateDescriptions: true,
  updateImages: true,
  updatePrices: true,
  updateSpecifications: true,
  updateStock: true
};

type RequestedSync = {
  limit: number | null;
  mode: "FULL" | "SAMPLE";
  requestedById: string | null;
  scope: SicoddSyncScope;
  trigger: "MANUAL" | "SCHEDULED";
};

type ListingCommercialData = {
  basePriceWithTax: string | null;
  stockByLocation: Array<{ location: string; quantity: number }>;
  stockTotal: number | null;
  supplierCostWithTax: string | null;
  volumePrices: Array<{ minimumQuantity: number; priceWithTax: string }>;
};

type SyncTotals = {
  created: number;
  failed: number;
  imagesDetected: number;
  imagesQueued: number;
  imagesSkipped: number;
  priceDecreased: number;
  priceIncreased: number;
  priceUnchanged: number;
  scanned: number;
  stockUnavailable: number;
  unchanged: number;
  updated: number;
};

function emptyTotals(): SyncTotals {
  return {
    created: 0,
    failed: 0,
    imagesDetected: 0,
    imagesQueued: 0,
    imagesSkipped: 0,
    priceDecreased: 0,
    priceIncreased: 0,
    priceUnchanged: 0,
    scanned: 0,
    stockUnavailable: 0,
    unchanged: 0,
    updated: 0
  };
}

function syncErrorSummary(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1900)
    : "No fue posible completar la sincronización con SICODD.";
}

function uppercase(value: string | null | undefined, fallback = "") {
  return (value ?? fallback).trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
}

function productSlug(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  return `${normalized || "producto-sicodd"}-${randomBytes(3).toString("hex")}`;
}

function numericMoney(value: string | null) {
  return value && decimalText(value) ? Number(decimalText(value)) : undefined;
}

function listingData(link: SicoddProductLink): ListingCommercialData {
  const stockByLocation = prepareSicoddStockLocations(link.stockByLocation);
  const validTiers = link.wholesaleTiers
    .map((tier) => ({
      minimumQuantity: Math.max(1, Math.trunc(tier.minimumQuantity)),
      priceWithTax: decimalText(tier.priceWithTax)
    }))
    .filter(
      (tier): tier is { minimumQuantity: number; priceWithTax: string } =>
        tier.priceWithTax !== null
    );
  return {
    basePriceWithTax: decimalText(link.priceWithTax),
    stockByLocation,
    stockTotal: stockByLocation.length ? sicoddStockTotal(stockByLocation) : null,
    supplierCostWithTax: decimalText(link.costWithTax),
    volumePrices: validTiers
  };
}

function readScope(value: unknown): SicoddSyncScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSicoddSyncScope;
  }
  const source = value as Record<string, unknown>;
  return {
    updateCategories:
      typeof source.updateCategories === "boolean"
        ? source.updateCategories
        : defaultSicoddSyncScope.updateCategories,
    updateCosts:
      typeof source.updateCosts === "boolean"
        ? source.updateCosts
        : defaultSicoddSyncScope.updateCosts,
    updateDescriptions:
      typeof source.updateDescriptions === "boolean"
        ? source.updateDescriptions
        : defaultSicoddSyncScope.updateDescriptions,
    updateImages:
      typeof source.updateImages === "boolean"
        ? source.updateImages
        : defaultSicoddSyncScope.updateImages,
    updatePrices:
      typeof source.updatePrices === "boolean"
        ? source.updatePrices
        : defaultSicoddSyncScope.updatePrices,
    updateSpecifications:
      typeof source.updateSpecifications === "boolean"
        ? source.updateSpecifications
        : defaultSicoddSyncScope.updateSpecifications,
    updateStock:
      typeof source.updateStock === "boolean"
        ? source.updateStock
        : defaultSicoddSyncScope.updateStock
  };
}

function suppliedDetailsHash(
  candidate: SicoddProductCandidate,
  listing: ListingCommercialData,
  catalogCode: string | null
) {
  return sicoddContentHash({
    catalogCode,
    candidate: {
      description: candidate.description,
      name: candidate.name,
      partNumber: candidate.partNumber,
      sourceKey: candidate.sourceKey,
      upc: candidate.upc,
      warrantyYears: candidate.warrantyYears
    },
    listing
  });
}

function sourceKeyFor(link: SicoddProductLink, candidate?: SicoddProductCandidate) {
  return (
    candidate?.sourceKey ||
    candidate?.upc ||
    candidate?.partNumber ||
    new URL(link.href).pathname + new URL(link.href).search
  )
    .trim()
    .slice(0, 220);
}

function productSku(candidate: SicoddProductCandidate, externalKey: string) {
  return (candidate.upc || candidate.partNumber || candidate.sourceKey || externalKey)
    .trim()
    .toLocaleUpperCase("es-MX")
    .slice(0, 80);
}

async function nextRunSequence(settingsId: string) {
  const latest = await database.sicoddSyncRun.findFirst({
    orderBy: { sequence: "desc" },
    select: { sequence: true },
    where: { settingsId }
  });
  return (latest?.sequence ?? 0) + 1;
}

export async function getOrCreateSicoddSettings() {
  return database.sicoddSyncSettings.upsert({
    create: { id: primarySicoddSettingsId },
    update: {},
    where: { id: primarySicoddSettingsId }
  });
}

export async function queueSicoddSync(request: RequestedSync) {
  const settings = await getOrCreateSicoddSettings();
  if (!settings.productListPath) {
    throw new Error(
      "Guarda primero la ruta interna que contiene el listado de productos."
    );
  }
  const sequence = await nextRunSequence(settings.id);
  return database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: true,
      includeImages: request.scope.updateImages,
      productListPath: settings.productListPath,
      requestedById: request.requestedById,
      requestedLimit: request.limit ?? undefined,
      scope: { mode: request.mode, ...request.scope },
      sequence,
      settingsId: settings.id,
      trigger: request.trigger,
      type: request.mode === "SAMPLE" ? "SAMPLE_CAPTURE" : "DAILY_SYNC"
    }
  });
}

async function findProductForSupplier(
  pageUrl: string,
  candidate: SicoddProductCandidate,
  sku: string
) {
  const identity: Prisma.ProductWhereInput[] = [{ supplierSourceUrl: pageUrl }];
  if (candidate.sourceKey) identity.push({ supplierSourceKey: candidate.sourceKey });
  if (sku) identity.push({ sku });
  return database.product.findFirst({
    include: {
      imageExclusions: { select: { sourceUrlHash: true } },
      imageDerivatives: {
        select: { sourceUrlHash: true },
        where: { status: { in: ["PENDING", "PROCESSING", "RETRY", "READY", "APPROVED"] } }
      }
    },
    where: { OR: identity }
  });
}

async function writeProductRecord(
  runId: string,
  record: Prisma.SicoddSyncProductRecordCreateInput
) {
  await database.sicoddSyncProductRecord.upsert({
    create: record,
    update: record,
    where: {
      runId_externalKey: {
        externalKey: record.externalKey,
        runId
      }
    }
  });
}

async function syncOneProduct(input: {
  candidate: SicoddProductCandidate;
  catalogCode: string | null;
  link: SicoddProductLink;
  pageUrl: string;
  sourceEtag: string | null;
  sourceLastModified: string | null;
  runId: string;
  scope: SicoddSyncScope;
  settings: Awaited<ReturnType<typeof getOrCreateSicoddSettings>>;
  updatedById: string;
}) {
  const listing = listingData(input.link);
  const externalKey = sourceKeyFor(input.link, input.candidate);
  const sku = productSku(input.candidate, externalKey);
  const detailsHash = suppliedDetailsHash(input.candidate, listing, input.catalogCode);
  const specsHash = sicoddContentHash(input.candidate.specifications);
  const freshImages = uniqueSupplierImageUrls(input.candidate.imageUrls);
  const imagesHash = sicoddContentHash(freshImages);
  const existing = await findProductForSupplier(input.pageUrl, input.candidate, sku);
  const subcategory = input.catalogCode
    ? await database.sicoddCatalogSubcategory.findUnique({
        select: { id: true, name: true },
        where: { code: input.catalogCode }
      })
    : null;

  const previousPrice = existing?.basePriceWithTax;
  const previousCost = existing?.supplierCostWithTax;
  const previousStock = existing?.stockTotal ?? null;
  const fields: string[] = [];
  const now = new Date();
  const excludedHashes = new Set(
    existing?.imageExclusions.map((item) => item.sourceUrlHash)
  );
  const activeImages = input.scope.updateImages
    ? withoutExcludedSupplierImages(freshImages, excludedHashes)
    : [];
  const alreadyQueued = new Set(
    existing?.imageDerivatives.map((item) => item.sourceUrlHash)
  );
  const newImageCount = activeImages.filter(
    (sourceUrl) => !alreadyQueued.has(productImageSourceHash(sourceUrl))
  ).length;

  if (existing) {
    const data: Prisma.ProductUpdateInput = {
      supplierLastSeenAt: now,
      supplierLastSyncedAt: now,
      supplierSourceEtag: input.sourceEtag,
      supplierSourceModifiedAt: input.sourceLastModified
    };
    if (
      input.scope.updatePrices &&
      !sameDecimal(previousPrice, listing.basePriceWithTax)
    ) {
      data.basePriceWithTax = numericMoney(listing.basePriceWithTax);
      fields.push("PRECIO");
    }
    if (
      input.scope.updatePrices &&
      sicoddContentHash(existing.volumePrices) !== sicoddContentHash(listing.volumePrices)
    ) {
      data.volumePrices = listing.volumePrices.length
        ? listing.volumePrices
        : Prisma.JsonNull;
      if (!fields.includes("PRECIO")) fields.push("PRECIO");
    }
    if (
      input.scope.updateCosts &&
      !sameDecimal(previousCost, listing.supplierCostWithTax)
    ) {
      data.supplierCostWithTax = numericMoney(listing.supplierCostWithTax);
      fields.push("COSTO");
    }
    if (input.scope.updateStock && previousStock !== listing.stockTotal) {
      data.specialOrder = listing.stockTotal === null || listing.stockTotal <= 0;
      data.stockByLocation = listing.stockByLocation.length
        ? listing.stockByLocation
        : Prisma.JsonNull;
      data.stockTotal = listing.stockTotal;
      data.stockUpdatedAt = listing.stockTotal === null ? null : now;
      fields.push("EXISTENCIAS");
    }
    if (input.scope.updateDescriptions && existing.supplierDetailsHash !== detailsHash) {
      const name = uppercase(input.candidate.name, input.link.label).slice(0, 500);
      data.description = uppercase(input.candidate.description, name).slice(0, 12_000);
      data.name = name || existing.name;
      data.partNumber = input.candidate.partNumber;
      data.upc = input.candidate.upc;
      data.warrantyYears = input.candidate.warrantyYears;
      data.supplierDetailsHash = detailsHash;
      data.supplierSourceKey = input.candidate.sourceKey;
      data.supplierSourceUrl = input.pageUrl;
      data.supplierSourcePayload = {
        ...input.candidate.sourcePayload,
        catalogCode: input.catalogCode,
        listing
      };
      fields.push("FICHA");
    }
    if (
      input.scope.updateSpecifications &&
      existing.supplierSpecificationsHash !== specsHash
    ) {
      data.specifications = input.candidate.specifications;
      data.supplierSpecificationsHash = specsHash;
      fields.push("ESPECIFICACIONES");
    }
    if (input.scope.updateImages && existing.supplierImagesHash !== imagesHash) {
      data.galleryUrls = activeImages;
      data.imageUrl = activeImages[0] ?? null;
      data.supplierImagesHash = imagesHash;
      fields.push("IMÁGENES");
    }
    if (input.scope.updateCategories && subcategory) {
      data.category = uppercase(subcategory.name).slice(0, 100);
      data.supplierSubcategory = { connect: { id: subcategory.id } };
      fields.push("CATEGORÍA");
    }

    const product = await database.$transaction(async (transaction) => {
      const updated = await transaction.product.update({
        data,
        where: { id: existing.id }
      });
      if (input.scope.updateImages && newImageCount) {
        await enqueueProductImages(
          transaction,
          updated.id,
          updated.imageUrl,
          updated.galleryUrls
        );
      }
      return updated;
    });
    await writeProductRecord(input.runId, {
      changedFields: fields,
      detailsHash,
      externalKey,
      imagesDetected: freshImages.length,
      imagesQueued: newImageCount,
      imagesSkipped: Math.max(0, freshImages.length - newImageCount),
      nextCostWithTax: numericMoney(listing.supplierCostWithTax),
      nextPriceWithTax: numericMoney(listing.basePriceWithTax),
      nextStockTotal: listing.stockTotal,
      previousCostWithTax: previousCost ?? undefined,
      previousPriceWithTax: previousPrice ?? undefined,
      previousStockTotal: previousStock ?? undefined,
      product: { connect: { id: product.id } },
      result: fields.length ? "UPDATED" : "UNCHANGED",
      run: { connect: { id: input.runId } },
      sku
    });
    return {
      fields,
      imagesDetected: freshImages.length,
      imagesQueued: newImageCount,
      imagesSkipped: Math.max(0, freshImages.length - newImageCount),
      nextPrice: numericMoney(listing.basePriceWithTax),
      nextStock: listing.stockTotal,
      previousPrice: previousPrice ? Number(previousPrice) : null,
      result: fields.length ? "UPDATED" : ("UNCHANGED" as const)
    };
  }

  const name = uppercase(input.candidate.name, input.link.label).slice(0, 500);
  const product = await database.$transaction(async (transaction) => {
    const created = await transaction.product.create({
      data: {
        basePriceWithTax: input.scope.updatePrices
          ? numericMoney(listing.basePriceWithTax)
          : undefined,
        category: uppercase(subcategory?.name, "PRODUCTOS SICODD").slice(0, 100),
        createdById: input.updatedById,
        description: uppercase(input.candidate.description, name).slice(0, 12_000),
        galleryUrls:
          input.scope.updateImages && activeImages.length ? activeImages : undefined,
        imageUrl: input.scope.updateImages ? (activeImages[0] ?? null) : null,
        name: name || `PRODUCTO SICODD ${sku}`,
        partNumber: input.candidate.partNumber,
        sku,
        slug: productSlug(name || sku),
        specialOrder: listing.stockTotal === null || listing.stockTotal <= 0,
        specifications:
          input.scope.updateSpecifications && input.candidate.specifications.length
            ? input.candidate.specifications
            : undefined,
        status: input.settings.importAsDraft ? "DRAFT" : "PUBLISHED",
        stockByLocation:
          input.scope.updateStock && listing.stockByLocation.length
            ? listing.stockByLocation
            : undefined,
        stockTotal: input.scope.updateStock ? listing.stockTotal : null,
        stockUpdatedAt:
          input.scope.updateStock && listing.stockTotal !== null ? now : null,
        supplierCostWithTax: input.scope.updateCosts
          ? numericMoney(listing.supplierCostWithTax)
          : undefined,
        supplierDetailsHash: detailsHash,
        supplierImagesHash: input.scope.updateImages ? imagesHash : undefined,
        supplierLastSeenAt: now,
        supplierLastSyncedAt: now,
        supplierSourceEtag: input.sourceEtag,
        supplierSourceModifiedAt: input.sourceLastModified,
        supplierSourceKey: input.candidate.sourceKey,
        supplierSourcePayload: {
          ...input.candidate.sourcePayload,
          catalogCode: input.catalogCode,
          listing
        },
        supplierSourceUrl: input.pageUrl,
        supplierSpecificationsHash: input.scope.updateSpecifications
          ? specsHash
          : undefined,
        supplierSubcategoryId: subcategory?.id,
        upc: input.candidate.upc,
        volumePrices: listing.volumePrices.length ? listing.volumePrices : undefined,
        warrantyYears: input.candidate.warrantyYears
      }
    });
    if (input.scope.updateImages && activeImages.length) {
      await enqueueProductImages(
        transaction,
        created.id,
        created.imageUrl,
        created.galleryUrls
      );
    }
    return created;
  });
  await writeProductRecord(input.runId, {
    changedFields: ["NUEVO_PRODUCTO"],
    detailsHash,
    externalKey,
    imagesDetected: freshImages.length,
    imagesQueued: activeImages.length,
    imagesSkipped: Math.max(0, freshImages.length - activeImages.length),
    nextCostWithTax: numericMoney(listing.supplierCostWithTax),
    nextPriceWithTax: numericMoney(listing.basePriceWithTax),
    nextStockTotal: listing.stockTotal,
    product: { connect: { id: product.id } },
    result: "CREATED",
    run: { connect: { id: input.runId } },
    sku
  });
  return {
    fields: ["NUEVO_PRODUCTO"],
    imagesDetected: freshImages.length,
    imagesQueued: activeImages.length,
    imagesSkipped: Math.max(0, freshImages.length - activeImages.length),
    nextPrice: numericMoney(listing.basePriceWithTax),
    nextStock: listing.stockTotal,
    previousPrice: null,
    result: "CREATED" as const
  };
}

async function syncNotModifiedSupplierPage(input: {
  catalogCode: string | null;
  link: SicoddProductLink;
  productId: string;
  runId: string;
  scope: SicoddSyncScope;
}) {
  const existing = await database.product.findUniqueOrThrow({
    where: { id: input.productId }
  });
  const listing = listingData(input.link);
  const fields: string[] = [];
  const data: Prisma.ProductUpdateInput = {
    supplierLastSeenAt: new Date(),
    supplierLastSyncedAt: new Date()
  };
  if (
    input.scope.updatePrices &&
    !sameDecimal(existing.basePriceWithTax, listing.basePriceWithTax)
  ) {
    data.basePriceWithTax = numericMoney(listing.basePriceWithTax);
    data.volumePrices = listing.volumePrices.length
      ? listing.volumePrices
      : Prisma.JsonNull;
    fields.push("PRECIO");
  }
  if (
    input.scope.updateCosts &&
    !sameDecimal(existing.supplierCostWithTax, listing.supplierCostWithTax)
  ) {
    data.supplierCostWithTax = numericMoney(listing.supplierCostWithTax);
    fields.push("COSTO");
  }
  if (input.scope.updateStock && existing.stockTotal !== listing.stockTotal) {
    data.specialOrder = listing.stockTotal === null || listing.stockTotal <= 0;
    data.stockByLocation = listing.stockByLocation.length
      ? listing.stockByLocation
      : Prisma.JsonNull;
    data.stockTotal = listing.stockTotal;
    data.stockUpdatedAt = listing.stockTotal === null ? null : new Date();
    fields.push("EXISTENCIAS");
  }
  if (input.scope.updateCategories && input.catalogCode) {
    const subcategory = await database.sicoddCatalogSubcategory.findUnique({
      select: { id: true, name: true },
      where: { code: input.catalogCode }
    });
    if (subcategory && existing.supplierSubcategoryId !== subcategory.id) {
      data.category = uppercase(subcategory.name).slice(0, 100);
      data.supplierSubcategory = { connect: { id: subcategory.id } };
      fields.push("CATEGORÍA");
    }
  }
  await database.product.update({ data, where: { id: existing.id } });
  const externalKey = sourceKeyFor(input.link);
  await writeProductRecord(input.runId, {
    changedFields: fields,
    externalKey,
    imagesDetected: 0,
    imagesQueued: 0,
    imagesSkipped: 0,
    nextCostWithTax: numericMoney(listing.supplierCostWithTax),
    nextPriceWithTax: numericMoney(listing.basePriceWithTax),
    nextStockTotal: listing.stockTotal,
    previousCostWithTax: existing.supplierCostWithTax ?? undefined,
    previousPriceWithTax: existing.basePriceWithTax ?? undefined,
    previousStockTotal: existing.stockTotal ?? undefined,
    product: { connect: { id: existing.id } },
    result: fields.length ? "UPDATED" : "UNCHANGED",
    run: { connect: { id: input.runId } },
    sku: existing.sku
  });
  return {
    fields,
    imagesDetected: 0,
    imagesQueued: 0,
    imagesSkipped: 0,
    nextPrice: numericMoney(listing.basePriceWithTax),
    nextStock: listing.stockTotal,
    previousPrice: existing.basePriceWithTax ? Number(existing.basePriceWithTax) : null,
    result: fields.length ? "UPDATED" : ("UNCHANGED" as const)
  };
}

function updateTotals(
  totals: SyncTotals,
  result: Awaited<ReturnType<typeof syncOneProduct>>
) {
  totals.scanned += 1;
  totals.imagesDetected += result.imagesDetected;
  totals.imagesQueued += result.imagesQueued;
  totals.imagesSkipped += result.imagesSkipped;
  if (result.result === "CREATED") totals.created += 1;
  if (result.result === "UPDATED") totals.updated += 1;
  if (result.result === "UNCHANGED") totals.unchanged += 1;
  if (result.nextStock !== null && result.nextStock <= 0) totals.stockUnavailable += 1;
  if (result.previousPrice !== null && result.nextPrice !== undefined) {
    if (result.nextPrice > result.previousPrice) totals.priceIncreased += 1;
    else if (result.nextPrice < result.previousPrice) totals.priceDecreased += 1;
    else totals.priceUnchanged += 1;
  }
}

async function targetsForRun(
  client: ReturnType<typeof createSicoddClient>,
  run: { productListPath: string | null; requestedLimit: number | null; scope: unknown }
) {
  const scope = readScope(run.scope);
  const mode =
    typeof run.scope === "object" && run.scope && !Array.isArray(run.scope)
      ? (run.scope as Record<string, unknown>).mode
      : "SAMPLE";
  const initialPath = run.productListPath ?? "/admin/producto?clave=MMUSB";
  const initial = await client.getHtml(initialPath);
  const families = extractSicoddCatalogTaxonomy(initial.html);
  if (families.length && scope.updateCategories) {
    await saveSicoddCatalogTaxonomy(families);
  }
  const paths =
    mode === "FULL" && families.length
      ? families.flatMap((family) =>
          family.subcategories.map(
            (subcategory) =>
              `/admin/producto?clave=${encodeURIComponent(subcategory.code)}`
          )
        )
      : [initialPath];
  const collected = new Map<
    string,
    { catalogCode: string | null; link: SicoddProductLink }
  >();
  const firstCode = new URL(initial.url).searchParams.get("clave")?.toUpperCase() ?? null;
  for (const link of extractProductEntries(initial.html, initial.url)) {
    collected.set(link.href, { catalogCode: firstCode, link });
  }
  for (const path of paths.slice(1)) {
    const listing = await client.getHtml(path);
    const catalogCode =
      new URL(listing.url).searchParams.get("clave")?.toUpperCase() ?? null;
    for (const link of extractProductEntries(listing.html, listing.url)) {
      collected.set(link.href, { catalogCode, link });
      if (run.requestedLimit && collected.size >= run.requestedLimit) break;
    }
    if (run.requestedLimit && collected.size >= run.requestedLimit) break;
  }
  return {
    families,
    links: [...collected.values()].slice(0, run.requestedLimit ?? undefined),
    scope
  };
}

/** Claims and executes a queued run. Full runs are processed by the operations worker. */
export async function processSicoddSyncRun(runId: string) {
  const claimed = await database.sicoddSyncRun.updateMany({
    data: { status: "RUNNING" },
    where: { id: runId, status: "QUEUED" }
  });
  if (!claimed.count) return { claimed: false, reason: "already-claimed" as const };

  const run = await database.sicoddSyncRun.findUniqueOrThrow({
    include: { settings: true },
    where: { id: runId }
  });
  await queueSicoddSyncStartedNotification(run);
  const totals = emptyTotals();
  const failures: string[] = [];
  const now = new Date();
  try {
    const client = createSicoddClient();
    await client.signIn();
    const { families, links, scope } = await targetsForRun(client, run);
    await recordSicoddWarehouses(
      links.flatMap((item) => item.link.stockByLocation),
      now
    );
    const actor =
      run.requestedById ??
      run.settings.updatedById ??
      (
        await database.adminUser.findFirstOrThrow({
          select: { id: true },
          orderBy: { createdAt: "asc" },
          where: { isActive: true }
        })
      ).id;

    for (const item of links) {
      try {
        const knownSource = await database.product.findFirst({
          select: { id: true, supplierSourceEtag: true },
          where: { supplierSourceUrl: item.link.href }
        });
        const page = await client.getHtml(item.link.href, {
          ifNoneMatch: knownSource?.supplierSourceEtag
        });
        if (page.notModified && knownSource) {
          const outcome = await syncNotModifiedSupplierPage({
            catalogCode: item.catalogCode,
            link: item.link,
            productId: knownSource.id,
            runId,
            scope
          });
          updateTotals(totals, outcome);
          continue;
        }
        const candidate = parseSicoddProductPage(page.html, page.url);
        const outcome = await syncOneProduct({
          candidate,
          catalogCode: item.catalogCode,
          link: item.link,
          pageUrl: page.url,
          runId,
          sourceEtag: page.etag,
          sourceLastModified: page.lastModified,
          scope,
          settings: run.settings,
          updatedById: actor
        });
        updateTotals(totals, outcome);
      } catch (error) {
        const externalKey = sourceKeyFor(item.link);
        const message = syncErrorSummary(error);
        totals.failed += 1;
        totals.scanned += 1;
        failures.push(`${externalKey}: ${message.slice(0, 180)}`);
        await writeProductRecord(runId, {
          changedFields: [],
          errorSummary: message.slice(0, 1000),
          externalKey,
          result: "FAILED",
          run: { connect: { id: runId } }
        });
      }
    }
    const finishedAt = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: {
          diagnostics: {
            ...totals,
            familiesDetected: families.length,
            failures: failures.slice(0, 30),
            message: `Se procesaron ${totals.scanned} artículos: ${totals.created} nuevos, ${totals.updated} actualizados y ${totals.unchanged} sin cambios.`,
            scope
          },
          finishedAt,
          status: "COMPLETED"
        },
        where: { id: runId }
      }),
      database.sicoddSyncSettings.update({
        data: {
          lastConnectionAt: finishedAt,
          lastConnectionError: null,
          ...(run.trigger === "SCHEDULED" ? { lastScheduledRunAt: finishedAt } : {})
        },
        where: { id: run.settingsId }
      })
    ]);
    await queueSicoddSyncCompletedNotification(run, totals);
    try {
      revalidateTag(commerceCatalogCacheTag, "max");
    } catch (error) {
      // The standalone operations worker does not have a Next.js request/static
      // generation store. Catalog facets also expire after five minutes, so a
      // cache invalidation failure must not turn a completed supplier sync into
      // a failed run after every product has already been persisted.
      console.warn(
        JSON.stringify({
          component: "sicodd-sync-worker",
          event: "catalog-cache-revalidation-skipped",
          reason: syncErrorSummary(error)
        })
      );
    }
    return { claimed: true, ...totals };
  } catch (error) {
    const message = syncErrorSummary(error);
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: { errorSummary: message, finishedAt: new Date(), status: "FAILED" },
        where: { id: runId }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionError: message },
        where: { id: run.settingsId }
      })
    ]);
    await queueSicoddSyncFailedNotification(run, message);
    return { claimed: true, error: message };
  }
}

export async function processNextQueuedSicoddSync() {
  const run = await database.sicoddSyncRun.findFirst({
    orderBy: { startedAt: "asc" },
    select: { id: true },
    where: { status: "QUEUED" }
  });
  return run ? processSicoddSyncRun(run.id) : null;
}

function mexicoCityClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Mexico_City",
    year: "numeric"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    month: value("month"),
    year: value("year")
  };
}

export async function queueDueScheduledSicoddSync(date = new Date()) {
  const settings = await getOrCreateSicoddSettings();
  if (!settings.scheduleEnabled || !settings.productListPath) return null;
  const clock = mexicoCityClock(date);
  if (clock.hour !== settings.scheduleHour || clock.minute !== settings.scheduleMinute) {
    return null;
  }
  const today = `${clock.year}-${clock.month}-${clock.day}`;
  const last = settings.lastScheduledRunAt
    ? mexicoCityClock(settings.lastScheduledRunAt)
    : null;
  if (last && `${last.year}-${last.month}-${last.day}` === today) return null;
  const alreadyQueued = await database.sicoddSyncRun.findFirst({
    select: { id: true },
    where: {
      settingsId: settings.id,
      status: { in: ["QUEUED", "RUNNING"] },
      trigger: "SCHEDULED"
    }
  });
  if (alreadyQueued) return alreadyQueued;
  return queueSicoddSync({
    limit: settings.scheduledFullSyncLimit,
    mode: "FULL",
    requestedById: settings.updatedById,
    scope: defaultSicoddSyncScope,
    trigger: "SCHEDULED"
  });
}
