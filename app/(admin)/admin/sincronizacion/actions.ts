"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  extractInternalAdminLinks,
  extractProductEntries,
  parseSicoddProductPage
} from "@/lib/sicodd/catalog-parser";
import { createSicoddClient } from "@/lib/sicodd/client";

const primarySettingsId = "sicodd-primary";

const settingsInput = z.object({
  includeExternalWarehouses: z.boolean(),
  includeImages: z.boolean(),
  importAsDraft: z.boolean(),
  productListPath: z.string().trim().max(512),
  sampleLimit: z.coerce.number().int().min(1).max(50)
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
  return database.sicoddSyncSettings.upsert({
    create: { id: primarySettingsId },
    update: {},
    where: { id: primarySettingsId }
  });
}

function errorSummary(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1900);
  return "No fue posible completar la comunicación con SICODD.";
}

function normalizeImportedDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
}

export async function saveSicoddSettings(formData: FormData) {
  const admin = await requireSyncManager();
  const parsed = settingsInput.safeParse({
    includeExternalWarehouses: formData.get("includeExternalWarehouses") === "on",
    includeImages: formData.get("includeImages") === "on",
    importAsDraft: formData.get("importAsDraft") === "on",
    productListPath: formData.get("productListPath") ?? "",
    sampleLimit: formData.get("sampleLimit")
  });
  if (!parsed.success) {
    throw new Error("Revisa el límite de muestra y los ajustes de sincronización.");
  }

  const productListPath = normalizeProductListPath(parsed.data.productListPath);
  await database.sicoddSyncSettings.upsert({
    create: {
      id: primarySettingsId,
      ...parsed.data,
      productListPath,
      updatedById: admin.id
    },
    update: { ...parsed.data, productListPath, updatedById: admin.id },
    where: { id: primarySettingsId }
  });
  revalidatePath("/admin/sincronizacion");
}

export async function testSicoddConnection() {
  const admin = await requireSyncManager();
  const settings = await getPrimarySettings();
  const run = await database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: settings.includeExternalWarehouses,
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

export async function captureSicoddSample() {
  const admin = await requireSyncManager();
  const settings = await getPrimarySettings();
  const run = await database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: settings.includeExternalWarehouses,
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
    const productLinks = extractProductEntries(listing.html, listing.url).slice(
      0,
      settings.sampleLimit
    );
    const failures: string[] = [];
    let captured = 0;

    for (const productLink of productLinks) {
      try {
        const productPage = await client.getHtml(productLink.href);
        const candidate = parseSicoddProductPage(productPage.html, productPage.url);
        const listingDescription = productLink.label
          ? normalizeImportedDescription(productLink.label)
          : null;
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
              listing: {
                costWithTax: productLink.costWithTax,
                marginMultiplier: productLink.marginMultiplier,
                priceWithTax: productLink.priceWithTax,
                stockByLocation: productLink.stockByLocation,
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
            detectedProductLinks: productLinks.length,
            failures: failures.slice(0, 10),
            listingPath: settings.productListPath,
            message:
              productLinks.length > 0
                ? "Muestra capturada como candidatos. Todavía no se creó ni publicó ningún producto."
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
}
