"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/app/generated/prisma/client";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  extractSicoddCatalogTaxonomy,
  extractInternalAdminLinks,
  extractProductEntries,
  parseSicoddProductPage
} from "@/lib/sicodd/catalog-parser";
import { saveSicoddCatalogTaxonomy } from "@/lib/sicodd/catalog-taxonomy";
import { createSicoddClient } from "@/lib/sicodd/client";
import {
  prepareSicoddStockLocations,
  sicoddStockTotal
} from "@/lib/sicodd/stock-locations";
import { recordSicoddWarehouses } from "@/lib/sicodd/warehouse-directory";
import {
  defaultSicoddSyncScope,
  getOrCreateSicoddSettings,
  primarySicoddSettingsId,
  processSicoddSyncRun,
  queueSicoddSync,
  type SicoddSyncScope
} from "@/lib/sicodd/sync";

const settingsInput = z.object({
  includeImages: z.boolean(),
  importAsDraft: z.boolean(),
  productListPath: z.string().trim().max(512),
  sampleLimit: z.coerce.number().int().min(1).max(50),
  scheduleEnabled: z.boolean(),
  scheduleHour: z.coerce.number().int().min(0).max(23),
  scheduleMinute: z.coerce.number().int().min(0).max(59),
  scheduledFullSyncLimit: z.coerce.number().int().min(1).max(20_000).nullable()
});

function normalizeProductListPath(path: string) {
  if (!path) return null;
  if (!path.startsWith("/admin/") || path.startsWith("//") || /[\r\n]/.test(path)) {
    throw new Error(
      "La ruta debe iniciar con /admin/ y permanecer dentro del portal SICODD."
    );
  }
  return path;
}

async function requireSyncManager() {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede ejecutar sincronizaciones del proveedor.");
  }
  return admin;
}

async function getPrimarySettings() {
  return getOrCreateSicoddSettings();
}

function errorSummary(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1900);
  return "No fue posible completar la comunicación con SICODD.";
}

function syncScopeFromFormData(formData: FormData): SicoddSyncScope {
  return {
    updateCategories: formData.get("updateCategories") === "on",
    updateCosts: formData.get("updateCosts") === "on",
    updateDescriptions: formData.get("updateDescriptions") === "on",
    updateImages: formData.get("updateImages") === "on",
    updatePrices: formData.get("updatePrices") === "on",
    updateSpecifications: formData.get("updateSpecifications") === "on",
    updateStock: formData.get("updateStock") === "on"
  };
}

function normalizeImportedDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
}

export async function saveSicoddSettings(formData: FormData) {
  const admin = await requireSyncManager();
  const parsed = settingsInput.safeParse({
    includeImages: formData.get("includeImages") === "on",
    importAsDraft: formData.get("importAsDraft") === "on",
    productListPath: formData.get("productListPath") ?? "",
    sampleLimit: formData.get("sampleLimit"),
    scheduleEnabled: formData.get("scheduleEnabled") === "on",
    scheduleHour: formData.get("scheduleHour"),
    scheduleMinute: formData.get("scheduleMinute"),
    scheduledFullSyncLimit: formData.get("scheduledFullSyncLimit")
      ? formData.get("scheduledFullSyncLimit")
      : null
  });
  if (!parsed.success) {
    throw new Error("Revisa el límite de muestra y los ajustes de sincronización.");
  }

  const productListPath = normalizeProductListPath(parsed.data.productListPath);
  await database.sicoddSyncSettings.upsert({
    create: {
      id: primarySicoddSettingsId,
      ...parsed.data,
      includeExternalWarehouses: true,
      productListPath,
      scheduleEnabled: parsed.data.scheduleEnabled,
      scheduleHour: parsed.data.scheduleHour,
      scheduleMinute: parsed.data.scheduleMinute,
      scheduledFullSyncLimit: parsed.data.scheduledFullSyncLimit,
      updatedById: admin.id
    },
    update: {
      ...parsed.data,
      includeExternalWarehouses: true,
      productListPath,
      scheduleEnabled: parsed.data.scheduleEnabled,
      scheduleHour: parsed.data.scheduleHour,
      scheduleMinute: parsed.data.scheduleMinute,
      scheduledFullSyncLimit: parsed.data.scheduledFullSyncLimit,
      updatedById: admin.id
    },
    where: { id: primarySicoddSettingsId }
  });
  revalidatePath("/admin/sincronizacion");
}

export async function testSicoddConnection() {
  const admin = await requireSyncManager();
  const settings = await getPrimarySettings();
  const run = await database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: true,
      includeImages: settings.includeImages,
      productListPath: settings.productListPath,
      requestedById: admin.id,
      settingsId: settings.id,
      type: "CONNECTION_TEST"
    }
  });

  try {
    const client = createSicoddClient();
    await client.signIn();
    const dashboard = await client.getHtml("/admin");
    const internalLinks = extractInternalAdminLinks(dashboard.html, dashboard.url).map(
      (link) => ({
        label: link.label,
        path: new URL(link.href).pathname + new URL(link.href).search
      })
    );
    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: {
          diagnostics: {
            dashboardPath: new URL(dashboard.url).pathname,
            internalLinks,
            message:
              "Conexión autenticada. Elige la ruta que lista productos antes de capturar una muestra."
          },
          finishedAt: now,
          status: "COMPLETED"
        },
        where: { id: run.id }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionAt: now, lastConnectionError: null },
        where: { id: settings.id }
      })
    ]);
  } catch (error) {
    const message = errorSummary(error);
    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: { errorSummary: message, finishedAt: now, status: "FAILED" },
        where: { id: run.id }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionError: message },
        where: { id: settings.id }
      })
    ]);
  }

  revalidatePath("/admin/sincronizacion");
}

export async function analyzeSicoddCatalog() {
  const admin = await requireSyncManager();
  const settings = await getPrimarySettings();
  const catalogPath = settings.productListPath?.startsWith("/admin/producto")
    ? settings.productListPath
    : "/admin/producto?clave=MMUSB";
  const run = await database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: true,
      includeImages: false,
      productListPath: catalogPath,
      requestedById: admin.id,
      settingsId: settings.id,
      type: "CATALOG_ANALYSIS"
    }
  });

  try {
    const client = createSicoddClient();
    await client.signIn();
    const catalog = await client.getHtml(catalogPath);
    const families = extractSicoddCatalogTaxonomy(catalog.html);
    if (!families.length) {
      throw new Error(
        "SICODD respondió, pero no encontramos su árbol de familias y subcategorías."
      );
    }
    const analyzedAt = new Date();
    const result = await saveSicoddCatalogTaxonomy(families, analyzedAt);
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: {
          diagnostics: {
            ...result,
            message: `Catálogo analizado: ${result.families} familias y ${result.subcategories} subcategorías. ${result.linkedProducts} productos existentes quedaron clasificados.`
          },
          finishedAt: analyzedAt,
          status: "COMPLETED"
        },
        where: { id: run.id }
      }),
      database.sicoddSyncSettings.update({
        data: {
          catalogAnalyzedAt: analyzedAt,
          lastConnectionAt: analyzedAt,
          lastConnectionError: null
        },
        where: { id: settings.id }
      })
    ]);
  } catch (error) {
    const message = errorSummary(error);
    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: { errorSummary: message, finishedAt: now, status: "FAILED" },
        where: { id: run.id }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionError: message },
        where: { id: settings.id }
      })
    ]);
  }

  revalidatePath("/admin/sincronizacion");
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro/catalogo");
}

export async function captureSicoddSample() {
  const admin = await requireSyncManager();
  const settings = await getPrimarySettings();
  const run = await database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: true,
      includeImages: settings.includeImages,
      productListPath: settings.productListPath,
      requestedById: admin.id,
      requestedLimit: settings.sampleLimit,
      settingsId: settings.id,
      type: "SAMPLE_CAPTURE"
    }
  });

  try {
    if (!settings.productListPath) {
      throw new Error(
        "Guarda primero la ruta interna que contiene el listado de productos."
      );
    }

    const client = createSicoddClient();
    await client.signIn();
    const listing = await client.getHtml(settings.productListPath);
    const catalogCode = new URL(listing.url).searchParams.get("clave")?.toUpperCase();
    const supplierSubcategory = catalogCode
      ? await database.sicoddCatalogSubcategory.findUnique({
          select: { id: true },
          where: { code: catalogCode }
        })
      : null;
    const productLinks = extractProductEntries(listing.html, listing.url).slice(
      0,
      settings.sampleLimit
    );
    const failures: string[] = [];
    let captured = 0;
    let refreshed = 0;
    const stockReadAt = new Date();

    await recordSicoddWarehouses(
      productLinks.flatMap((product) => product.stockByLocation),
      stockReadAt
    );

    for (const productLink of productLinks) {
      try {
        const productPage = await client.getHtml(productLink.href);
        const candidate = parseSicoddProductPage(productPage.html, productPage.url);
        const listingDescription = productLink.label
          ? normalizeImportedDescription(productLink.label)
          : null;
        const stockByLocation = prepareSicoddStockLocations(productLink.stockByLocation);
        const productIdentity: Prisma.ProductWhereInput[] = [
          { supplierSourceUrl: productPage.url }
        ];
        if (candidate.sourceKey) {
          productIdentity.push({ supplierSourceKey: candidate.sourceKey });
        }
        if (candidate.upc) productIdentity.push({ sku: candidate.upc.toUpperCase() });
        if (candidate.partNumber) {
          productIdentity.push({ sku: candidate.partNumber.toUpperCase() });
        }
        const existingProduct = await database.product.findFirst({
          select: { id: true },
          where: { OR: productIdentity }
        });

        if (existingProduct) {
          await database.product.update({
            data: {
              specialOrder: stockByLocation.length
                ? sicoddStockTotal(stockByLocation) <= 0
                : true,
              stockByLocation: stockByLocation.length ? stockByLocation : undefined,
              stockTotal: stockByLocation.length
                ? sicoddStockTotal(stockByLocation)
                : null,
              stockUpdatedAt: stockByLocation.length ? stockReadAt : null,
              supplierSubcategoryId: supplierSubcategory?.id
            },
            where: { id: existingProduct.id }
          });
          refreshed += 1;
          continue;
        }

        await database.sicoddImportCandidate.create({
          data: {
            description: candidate.description
              ? normalizeImportedDescription(candidate.description)
              : listingDescription,
            imageUrls: settings.includeImages ? candidate.imageUrls : undefined,
            name: candidate.name
              ? normalizeImportedDescription(candidate.name)
              : (listingDescription?.slice(0, 500) ?? null),
            partNumber: candidate.partNumber,
            runId: run.id,
            sourceKey: candidate.sourceKey,
            sourcePayload: {
              ...candidate.sourcePayload,
              ...(catalogCode ? { catalogCode } : {}),
              listing: {
                costWithTax: productLink.costWithTax,
                marginMultiplier: productLink.marginMultiplier,
                priceWithTax: productLink.priceWithTax,
                stockByLocation,
                wholesaleTiers: productLink.wholesaleTiers
              }
            },
            sourceUrl: productPage.url,
            specifications: candidate.specifications.length
              ? candidate.specifications
              : undefined,
            upc: candidate.upc,
            warrantyYears: candidate.warrantyYears
          }
        });
        captured += 1;
      } catch (error) {
        failures.push(
          `${new URL(productLink.href).pathname}: ${errorSummary(error).slice(0, 180)}`
        );
      }
    }

    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: {
          diagnostics: {
            captured,
            refreshed,
            detectedProductLinks: productLinks.length,
            failures: failures.slice(0, 10),
            listingPath: settings.productListPath,
            message:
              productLinks.length > 0
                ? `Muestra leída: ${captured} candidatos nuevos y ${refreshed} productos con existencias actualizadas.`
                : "No se detectaron enlaces de producto en esta ruta. Revisa la ruta o ajustamos el mapeo con una ejecución de prueba."
          },
          finishedAt: now,
          status: "COMPLETED"
        },
        where: { id: run.id }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionAt: now, lastConnectionError: null },
        where: { id: settings.id }
      })
    ]);
  } catch (error) {
    const message = errorSummary(error);
    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: { errorSummary: message, finishedAt: now, status: "FAILED" },
        where: { id: run.id }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionError: message },
        where: { id: settings.id }
      })
    ]);
  }

  revalidatePath("/admin/sincronizacion");
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro/catalogo");
  revalidatePath("/suministro/catalogo/[slug]", "page");
}

/** The current incremental sample: it updates only fields selected in the form. */
export async function runIncrementalSicoddSample(formData: FormData) {
  const admin = await requireSyncManager();
  const settings = await getPrimarySettings();
  const selectedScope = syncScopeFromFormData(formData);
  const scope = Object.values(selectedScope).some(Boolean)
    ? selectedScope
    : defaultSicoddSyncScope;
  const run = await queueSicoddSync({
    limit: settings.sampleLimit,
    mode: "SAMPLE",
    requestedById: admin.id,
    scope,
    trigger: "MANUAL"
  });
  // Samples are intentionally bounded and execute immediately for a useful test.
  await processSicoddSyncRun(run.id);
  revalidatePath("/admin/sincronizacion");
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro/catalogo");
  revalidatePath("/suministro/catalogo/[slug]", "page");
}

/** Full scans are queued for the dedicated operations worker, never a web request. */
export async function queueFullSicoddSync(formData: FormData) {
  const admin = await requireSyncManager();
  const parsedLimit = z.coerce
    .number()
    .int()
    .min(1)
    .max(20_000)
    .nullable()
    .safeParse(formData.get("fullSyncLimit") || null);
  if (!parsedLimit.success) {
    throw new Error("El lÃ­mite completo debe estar entre 1 y 20,000.");
  }
  const selectedScope = syncScopeFromFormData(formData);
  await queueSicoddSync({
    limit: parsedLimit.data,
    mode: "FULL",
    requestedById: admin.id,
    scope: Object.values(selectedScope).some(Boolean)
      ? selectedScope
      : defaultSicoddSyncScope,
    trigger: "MANUAL"
  });
  revalidatePath("/admin/sincronizacion");
}
