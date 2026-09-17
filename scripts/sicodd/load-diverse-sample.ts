import { randomBytes } from "node:crypto";

import "dotenv/config";

import {
  type SicoddProductLink,
  extractProductEntries,
  parseSicoddProductPage
} from "../../lib/sicodd/catalog-parser";
import { createSicoddClient } from "../../lib/sicodd/client";
import { database } from "../../lib/database";
import { getSicoddImageFrameColors } from "../../lib/sicodd/image-frame-colors";
import { filterSicoddStockLocations } from "../../lib/sicodd/stock-locations";

type CatalogTarget = {
  category: string;
  code: string;
};

type SelectedProductLink = SicoddProductLink & {
  target: CatalogTarget;
};

const targets: CatalogTarget[] = [
  { category: "GABINETES", code: "GBGC" },
  { category: "MONITORES", code: "MTLED" },
  { category: "ALMACENAMIENTO", code: "DDSSD" },
  { category: "REDES", code: "RDSW" },
  { category: "TECLADOS", code: "TC" },
  { category: "MOUSES", code: "MSOP" },
  { category: "MEMORIAS", code: "MMUSB" },
  { category: "TARJETAS DE VIDEO", code: "TVPCI" },
  { category: "PROCESADORES", code: "PRAM5" },
  { category: "VIDEOVIGILANCIA", code: "VIGCVG" }
];

const knownBrands = [
  "3M",
  "3NSTAR",
  "ACER",
  "ACTECK",
  "ADATA",
  "AMD",
  "ANTEC",
  "APC",
  "APPLE",
  "ASUS",
  "AOC",
  "BENQ",
  "BROTHER",
  "CORSAIR",
  "CRUCIAL",
  "DAHUA",
  "DELL",
  "D-LINK",
  "EATON",
  "EPSON",
  "EVGA",
  "GIGABYTE",
  "GENIUS",
  "HILOOK",
  "HIKVISION",
  "HP",
  "HUAWEI",
  "HYPERX",
  "INTEL",
  "KINGSTON",
  "KIOXIA",
  "LENOVO",
  "LG",
  "LOGITECH",
  "MANHATTAN",
  "MERCUSYS",
  "MICRON",
  "MSI",
  "NETGEAR",
  "PATRIOT",
  "SAMSUNG",
  "SANDISK",
  "SEAGATE",
  "SONY",
  "STYLOS",
  "TARGUS",
  "TENDA",
  "THERMALTAKE",
  "TP-LINK",
  "TRANSCEND",
  "UBIQUITI",
  "VIEWSONIC",
  "VORAGO",
  "WESTERN DIGITAL",
  "XIAOMI",
  "XZEAL",
  "ZOTAC"
] as const;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readLimit() {
  const limit = Number.parseInt(argument("--limit") ?? "50", 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new Error("--limit must be an integer between 1 and 200.");
  }
  return limit;
}

function uppercase(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-MX");
}

function brandFor(value: string) {
  const normalized = uppercase(value);
  for (const brand of knownBrands) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|[^A-Z0-9])${escaped}(?:$|[^A-Z0-9])`).test(normalized)) {
      return brand;
    }
  }
  return null;
}

function productSlug(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
  return `${normalized || "producto"}-${randomBytes(3).toString("hex")}`;
}

function decimal(value: string | null) {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function selectDiverseLinks(
  pools: Map<string, SelectedProductLink[]>,
  limit: number
) {
  const ordered: SelectedProductLink[] = [];
  const longestPool = Math.max(0, ...[...pools.values()].map((links) => links.length));
  for (let index = 0; index < longestPool; index += 1) {
    for (const target of targets) {
      const link = pools.get(target.code)?.[index];
      if (link) ordered.push(link);
    }
  }

  const selected: SelectedProductLink[] = [];
  const selectedUrls = new Set<string>();
  const selectedBrands = new Set<string>();
  const add = (link: SelectedProductLink) => {
    if (selected.length >= limit || selectedUrls.has(link.href)) return;
    selected.push(link);
    selectedUrls.add(link.href);
    const brand = brandFor(link.label);
    if (brand) selectedBrands.add(brand);
  };

  for (const link of ordered) {
    const brand = brandFor(link.label);
    if (brand && !selectedBrands.has(brand)) add(link);
  }
  for (const link of ordered) add(link);

  return selected;
}

const limit = readLimit();
const dryRun = process.argv.includes("--dry-run");
const poolLimit = Math.max(12, Math.ceil(limit / targets.length) + 10);
const client = createSicoddClient();
let runId: string | null = null;

try {
  const [admin, storedSettings] = await Promise.all([
    dryRun
      ? Promise.resolve(null)
      : database.adminUser.findFirstOrThrow({
          orderBy: { createdAt: "asc" },
          where: { isActive: true }
        }),
    database.sicoddSyncSettings.findUnique({ where: { id: "sicodd-primary" } })
  ]);
  const settings =
    storedSettings ??
    (dryRun
      ? {
          id: "sicodd-primary",
          includeExternalWarehouses: false,
          includeImages: true,
          importAsDraft: true
        }
      : await database.sicoddSyncSettings.create({
          data: { id: "sicodd-primary", updatedById: admin!.id }
        }));

  if (!dryRun) {
    const run = await database.sicoddSyncRun.create({
      data: {
        includeExternalWarehouses: settings.includeExternalWarehouses,
        includeImages: settings.includeImages,
        productListPath: "/admin/producto?clave=<MUESTRA_DIVERSA>",
        requestedById: admin!.id,
        requestedLimit: limit,
        settingsId: settings.id,
        type: "SAMPLE_CAPTURE"
      }
    });
    runId = run.id;
  }

  await client.signIn();
  const pools = new Map<string, SelectedProductLink[]>();
  for (const target of targets) {
    const path = `/admin/producto?clave=${encodeURIComponent(target.code)}`;
    const listing = await client.getHtml(path);
    const links = extractProductEntries(listing.html, listing.url)
      .filter((link) => /\/admin\/producto\/ficha\//i.test(link.href))
      .slice(0, poolLimit)
      .map((link) => ({ ...link, target }));
    pools.set(target.code, links);
  }

  const availableLinks = [...pools.values()].reduce((total, links) => total + links.length, 0);
  const selected = selectDiverseLinks(pools, availableLinks);
  const failures: string[] = [];
  const skippedExisting: string[] = [];
  const created: Array<{ brand: string | null; category: string; sku: string }> = [];

  for (const link of selected) {
    if (created.length >= limit) break;

    try {
      const page = await client.getHtml(link.href);
      const candidate = parseSicoddProductPage(page.html, page.url);
      const description = uppercase(candidate.description ?? link.label);
      const sku = uppercase(candidate.upc ?? candidate.partNumber ?? candidate.sourceKey ?? "").slice(
        0,
        80
      );
      if (!sku) {
        failures.push(`${link.target.code}: producto sin UPC, parte ni clave.`);
        continue;
      }

      const exists = await database.product.findUnique({
        select: { id: true },
        where: { sku }
      });
      if (exists) {
        skippedExisting.push(sku);
        continue;
      }

      const brand = brandFor(`${description} ${link.label}`);
      const supplierStock = link.stockByLocation.flatMap((location) =>
        typeof location.quantity === "number" && Number.isFinite(location.quantity)
          ? [{ location: uppercase(location.location), quantity: location.quantity }]
          : []
      );
      const stockByLocation = filterSicoddStockLocations(
        supplierStock,
        settings.includeExternalWarehouses
      );
      const stockTotal = stockByLocation.reduce((sum, location) => sum + location.quantity, 0);
      const imageUrls = settings.includeImages ? candidate.imageUrls : [];
      const imageFrameColors = dryRun
        ? []
        : await getSicoddImageFrameColors(imageUrls);
      const sourcePayload = {
        ...candidate.sourcePayload,
        catalogCategory: link.target.category,
        catalogCode: link.target.code,
        listing: {
          costWithTax: link.costWithTax,
          marginMultiplier: link.marginMultiplier,
          priceWithTax: link.priceWithTax,
          stockByLocation,
          wholesaleTiers: link.wholesaleTiers
        }
      };

      if (dryRun) {
        created.push({ brand, category: link.target.category, sku });
        continue;
      }

      await database.$transaction(async (transaction) => {
        const importedCandidate = await transaction.sicoddImportCandidate.create({
          data: {
            description,
            imageUrls: imageUrls.length ? imageUrls : undefined,
            name: description.slice(0, 500),
            partNumber: candidate.partNumber,
            runId: runId!,
            sourceKey: candidate.sourceKey,
            sourcePayload,
            sourceUrl: page.url,
            specifications: candidate.specifications.length ? candidate.specifications : undefined,
            upc: candidate.upc,
            warrantyYears: candidate.warrantyYears
          }
        });
        const product = await transaction.product.create({
          data: {
            basePriceWithTax: decimal(link.priceWithTax),
            brand,
            category: link.target.category,
            createdById: admin!.id,
            description,
            imageFrameColors: imageFrameColors.length ? imageFrameColors : undefined,
            galleryUrls: imageUrls.length ? imageUrls : undefined,
            imageUrl: imageUrls[0] ?? null,
            name: description.slice(0, 500),
            partNumber: candidate.partNumber,
            sku,
            slug: productSlug(description),
            specialOrder: stockByLocation.length ? stockTotal <= 0 : true,
            specifications: candidate.specifications.length ? candidate.specifications : undefined,
            status: settings.importAsDraft ? "DRAFT" : "PUBLISHED",
            stockByLocation: stockByLocation.length ? stockByLocation : undefined,
            stockTotal: stockByLocation.length ? stockTotal : null,
            supplierCostWithTax: decimal(link.costWithTax),
            supplierSourceKey: candidate.sourceKey,
            supplierSourceUrl: page.url,
            upc: candidate.upc,
            volumePrices: link.wholesaleTiers.length ? link.wholesaleTiers : undefined,
            warrantyYears: candidate.warrantyYears
          }
        });
        await transaction.sicoddImportCandidate.update({
          data: {
            productId: product.id,
            reviewedAt: new Date(),
            reviewedById: admin!.id,
            status: "IMPORTED"
          },
          where: { id: importedCandidate.id }
        });
      });
      created.push({ brand, category: link.target.category, sku });
    } catch (error) {
      failures.push(
        `${link.target.code}: ${error instanceof Error ? error.message.slice(0, 180) : "error"}`
      );
    }
  }

  const categoryCounts = Object.fromEntries(
    targets.map((target) => [
      target.category,
      created.filter((product) => product.category === target.category).length
    ])
  );
  const brandCounts = Object.fromEntries(
    [...new Set(created.map((product) => product.brand).filter(Boolean))]
      .sort()
      .map((brand) => [brand!, created.filter((product) => product.brand === brand).length])
  );

  if (runId) {
    const now = new Date();
    await database.$transaction([
      database.sicoddSyncRun.update({
        data: {
          diagnostics: {
            brandCounts,
            categoryCounts,
            created: created.length,
            detectedProductLinks: Object.fromEntries(
              [...pools.entries()].map(([code, links]) => [code, links.length])
            ),
            failures: failures.slice(0, 12),
            message: `Muestra diversa cargada como ${
              settings.importAsDraft ? "borradores" : "productos publicados"
            }.`,
            selected: selected.length,
            skippedExisting: skippedExisting.slice(0, 20)
          },
          finishedAt: now,
          status: "COMPLETED"
        },
        where: { id: runId }
      }),
      database.sicoddSyncSettings.update({
        data: { lastConnectionAt: now, lastConnectionError: null },
        where: { id: settings.id }
      })
    ]);
  }

  console.log(
    JSON.stringify(
      {
        brandCounts,
        categoryCounts,
        created: created.length,
        dryRun,
        failures,
        runId,
        selected: selected.length,
        skippedExisting: skippedExisting.length
      },
      null,
      2
    )
  );
} catch (error) {
  if (runId) {
    await database.sicoddSyncRun.update({
      data: {
        errorSummary: error instanceof Error ? error.message.slice(0, 1900) : "Sample load failed.",
        finishedAt: new Date(),
        status: "FAILED"
      },
      where: { id: runId }
    });
  }
  throw error;
} finally {
  await database.$disconnect();
}
