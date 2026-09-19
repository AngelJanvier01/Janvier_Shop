import { randomBytes } from "node:crypto";

import "dotenv/config";

import {
  type SicoddProductLink,
  extractSicoddCatalogTaxonomy,
  extractProductEntries,
  parseSicoddProductPage
} from "../../lib/sicodd/catalog-parser";
import { saveSicoddCatalogTaxonomy } from "../../lib/sicodd/catalog-taxonomy";
import { createSicoddClient } from "../../lib/sicodd/client";
import { database } from "../../lib/database";
import { getSicoddImageFrameColors } from "../../lib/sicodd/image-frame-colors";
import {
  prepareSicoddStockLocations,
  sicoddStockTotal
} from "../../lib/sicodd/stock-locations";
import { recordSicoddWarehouses } from "../../lib/sicodd/warehouse-directory";
import { enqueueProductImages } from "../../lib/product-images/queue";

type CatalogTarget = {
  category: string;
  code: string;
};

type SelectedProductLink = SicoddProductLink & {
  target: CatalogTarget;
};

const targets: CatalogTarget[] = [
  { category: "AUDIO Y BOCINAS", code: "AUDD" },
  { category: "CABLES Y ACCESORIOS", code: "CBAD" },
  { category: "COMPUTADORAS / SERVIDORES", code: "CMCES" },
  { category: "CONSUMIBLES E INSUMOS", code: "CNTO" },
  { category: "CÁMARAS", code: "DCCIP" },
  { category: "GABINETES", code: "GBGC" },
  { category: "IMPRESORAS", code: "PTLS" },
  { category: "LAPTOPS", code: "LPNT" },
  { category: "MONITORES", code: "MTLED" },
  { category: "ALMACENAMIENTO", code: "DDSSD" },
  { category: "REDES", code: "RDSW" },
  { category: "PUNTO DE VENTA", code: "PVESC" },
  { category: "REGULADORES, NOBREAKS Y ENERGIA", code: "RGNB" },
  { category: "TABLETS Y ACCESORIOS PARA TABLET", code: "TABTAB" },
  { category: "TECLADOS", code: "TCTE" },
  { category: "TELEFONOS", code: "TELTIP" },
  { category: "TARJETAS MADRE", code: "TM17" },
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
  "BALAM RUSH",
  "BENQ",
  "GENERICO",
  "BROTHER",
  "CDP",
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
  "HOSTECH",
  "HP",
  "HUAWEI",
  "HYPERX",
  "IMOU",
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
  "NEXTEP",
  "ORAIMO",
  "PATRIOT",
  "RUIJIE",
  "SAMSUNG",
  "SANDISK",
  "SEAGATE",
  "SMARTBITT",
  "SONY",
  "STYLOS",
  "TARGUS",
  "TENDA",
  "THERMALTAKE",
  "TP-LINK",
  "TRANSCEND",
  "UGREEN",
  "UBIQUITI",
  "VIEWSONIC",
  "VORAGO",
  "WESTERN DIGITAL",
  "WD",
  "XIAOMI",
  "XPG",
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
// The first rows of a supplier subcategory may already exist locally. Keep a
// deeper pool so --limit represents new catalog records, not only inspected rows.
const poolLimit = Math.max(40, Math.ceil((limit * 2) / targets.length) + 8);
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
          includeExternalWarehouses: true,
          includeImages: true,
          importAsDraft: true
        }
      : await database.sicoddSyncSettings.create({
          data: { id: "sicodd-primary", updatedById: admin!.id }
        }));

  if (!dryRun) {
    const run = await database.sicoddSyncRun.create({
      data: {
        includeExternalWarehouses: true,
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
  const subcategoryIds = new Map<string, string>();
  const categoryBySubcategoryCode = new Map<string, string>();
  let taxonomySaved = false;
  for (const target of targets) {
    const path = `/admin/producto?clave=${encodeURIComponent(target.code)}`;
    const listing = await client.getHtml(path);
    const taxonomy = extractSicoddCatalogTaxonomy(listing.html);
    for (const family of taxonomy) {
      for (const subcategory of family.subcategories) {
        categoryBySubcategoryCode.set(subcategory.code, uppercase(family.name));
      }
    }
    if (!dryRun && !taxonomySaved && taxonomy.length) {
        await saveSicoddCatalogTaxonomy(taxonomy);
        const storedSubcategories = await database.sicoddCatalogSubcategory.findMany({
          select: { code: true, id: true }
        });
        for (const item of storedSubcategories) subcategoryIds.set(item.code, item.id);
        taxonomySaved = true;
    }
    const links = extractProductEntries(listing.html, listing.url)
      .filter((link) => /\/admin\/producto\/ficha\//i.test(link.href))
      .slice(0, poolLimit)
      .map((link) => ({ ...link, target }));
    pools.set(target.code, links);
  }

  if (!dryRun && !taxonomySaved) {
    throw new Error("SICODD no devolvió la taxonomía de familias y subfamilias.");
  }

  const availableLinks = [...pools.values()].reduce((total, links) => total + links.length, 0);
  const selected = selectDiverseLinks(pools, availableLinks);
  const failures: string[] = [];
  const skippedExisting: string[] = [];
  const created: Array<{ brand: string | null; category: string; sku: string }> = [];
  const refreshed: string[] = [];
  let inspected = 0;
  const stockReadAt = new Date();

  if (!dryRun) {
    await recordSicoddWarehouses(
      selected.flatMap((product) => product.stockByLocation),
      stockReadAt
    );
  }

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
      inspected += 1;

      const brand = brandFor(`${description} ${link.label}`);
      const category =
        categoryBySubcategoryCode.get(link.target.code) ?? link.target.category;
      const stockByLocation = prepareSicoddStockLocations(
        link.stockByLocation
      );
      const stockTotal = sicoddStockTotal(stockByLocation);
      const exists = await database.product.findUnique({
        select: { id: true },
        where: { sku }
      });
      if (exists) {
        if (!dryRun) {
          await database.product.update({
            data: {
              specialOrder: stockByLocation.length ? stockTotal <= 0 : true,
              stockByLocation: stockByLocation.length ? stockByLocation : undefined,
              stockTotal: stockByLocation.length ? stockTotal : null,
              stockUpdatedAt: stockByLocation.length ? stockReadAt : null,
              supplierSourceKey: candidate.sourceKey,
              supplierSourceUrl: page.url,
              supplierSubcategoryId: subcategoryIds.get(link.target.code)
            },
            where: { id: exists.id }
          });
        }
        refreshed.push(sku);
        skippedExisting.push(sku);
        continue;
      }

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
        created.push({ brand, category, sku });
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
            category,
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
            stockUpdatedAt: stockByLocation.length ? stockReadAt : null,
            supplierCostWithTax: decimal(link.costWithTax),
            supplierSourceKey: candidate.sourceKey,
            supplierSourceUrl: page.url,
            supplierSubcategoryId: subcategoryIds.get(link.target.code),
            upc: candidate.upc,
            volumePrices: link.wholesaleTiers.length ? link.wholesaleTiers : undefined,
            warrantyYears: candidate.warrantyYears
          }
        });
        await enqueueProductImages(
          transaction,
          product.id,
          product.imageUrl,
          product.galleryUrls
        );
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
      created.push({ brand, category, sku });
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
            inspected,
            message: `Inventario actualizado en ${refreshed.length} productos y ${created.length} fichas nuevas cargadas como ${
              settings.importAsDraft ? "borradores" : "productos publicados"
            }.`,
            requestedNewProducts: limit,
            refreshed: refreshed.length,
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
        refreshed: refreshed.length,
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
