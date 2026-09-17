import "dotenv/config";

import {
  extractProductEntries,
  parseSicoddProductPage
} from "../../lib/sicodd/catalog-parser";
import { createSicoddClient } from "../../lib/sicodd/client";
import { database } from "../../lib/database";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readCatalogCode() {
  const code = argument("--clave")?.trim().toUpperCase() || "GBGC";
  if (!/^[A-Z0-9]{2,24}$/.test(code)) {
    throw new Error("--clave must be a SICODD family or subfamily code.");
  }
  return code;
}

function readLimit() {
  const limit = Number.parseInt(argument("--limit") ?? "5", 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("--limit must be an integer between 1 and 50.");
  }
  return limit;
}

function uppercase(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
}

const catalogCode = readCatalogCode();
const limit = readLimit();
const persist = process.argv.includes("--persist");
const client = createSicoddClient();
const productListPath = `/admin/producto?clave=${encodeURIComponent(catalogCode)}`;
let runId: string | null = null;

if (persist) {
  const admin = await database.adminUser.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
    where: { isActive: true }
  });
  const settings = await database.sicoddSyncSettings.upsert({
    create: {
      id: "sicodd-primary",
      productListPath,
      sampleLimit: limit,
      updatedById: admin.id
    },
    update: { productListPath, sampleLimit: limit, updatedById: admin.id },
    where: { id: "sicodd-primary" }
  });
  const run = await database.sicoddSyncRun.create({
    data: {
      includeExternalWarehouses: settings.includeExternalWarehouses,
      includeImages: settings.includeImages,
      productListPath,
      requestedById: admin.id,
      requestedLimit: limit,
      settingsId: settings.id,
      type: "SAMPLE_CAPTURE"
    }
  });
  runId = run.id;
}

try {
  await client.signIn();
  const listing = await client.getHtml(productListPath);
  const links = extractProductEntries(listing.html, listing.url).slice(0, limit);
  const products = [];

  for (const link of links) {
    const page = await client.getHtml(link.href);
    const product = parseSicoddProductPage(page.html, page.url);
    const description = uppercase(product.description ?? link.label);
    const captured = {
      description,
      imageUrls: product.imageUrls,
      partNumber: product.partNumber,
      sourceKey: product.sourceKey,
      sourcePayload: product.sourcePayload,
      sourceUrl: page.url,
      specifications: product.specifications,
      upc: product.upc,
      warrantyYears: product.warrantyYears,
      listing: {
        costWithTax: link.costWithTax,
        marginMultiplier: link.marginMultiplier,
        priceWithTax: link.priceWithTax,
        stockByLocation: link.stockByLocation,
        wholesaleTiers: link.wholesaleTiers
      }
    };
    products.push(captured);

    if (runId) {
      await database.sicoddImportCandidate.create({
        data: {
          description,
          imageUrls: captured.imageUrls,
          name: description.slice(0, 500),
          partNumber: captured.partNumber,
          runId,
          sourceKey: captured.sourceKey,
          sourcePayload: {
            ...captured.sourcePayload,
            listing: captured.listing
          },
          sourceUrl: captured.sourceUrl,
          specifications: captured.specifications.length ? captured.specifications : undefined,
          upc: captured.upc,
          warrantyYears: captured.warrantyYears
        }
      });
    }
  }

  if (runId) {
    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: {
          diagnostics: {
            captured: products.length,
            catalogCode,
            detectedProductLinks: links.length,
            listingPath: productListPath,
            message: "Muestra capturada como candidatos. Todavía no se creó ni publicó ningún producto."
          },
          finishedAt: now,
          status: "COMPLETED"
        },
        where: { id: runId }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionAt: now, lastConnectionError: null },
        where: { id: "sicodd-primary" }
      })
    ]);
  }

  console.log(
    JSON.stringify(
      {
        catalogCode,
        captured: products.length,
        limit,
        persistedRunId: runId,
        products
      },
      null,
      2
    )
  );
} catch (error) {
  if (runId) {
    await database.sicoddSyncRun.update({
      data: {
        errorSummary: error instanceof Error ? error.message.slice(0, 1900) : "Sample capture failed.",
        finishedAt: new Date(),
        status: "FAILED"
      },
      where: { id: runId }
    });
  }
  throw error;
} finally {
  if (persist) await database.$disconnect();
}
