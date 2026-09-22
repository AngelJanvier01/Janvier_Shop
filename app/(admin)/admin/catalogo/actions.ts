"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { specificationsFromLines } from "@/lib/commerce/product-specifications";
import { database } from "@/lib/database";
import { enqueueProductImages } from "@/lib/product-images/queue";
import { removeProductImageStorageKey } from "@/lib/product-images/storage";
import { getSicoddImageFrameColors } from "@/lib/sicodd/image-frame-colors";
import { candidateCatalogCode } from "@/lib/sicodd/catalog-taxonomy";
import { prepareSicoddStockLocations } from "@/lib/sicodd/stock-locations";

const productInput = z.object({
  brand: z.string().trim().max(100),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(24).max(2400),
  imageUrl: z.string().trim().url().max(2048).or(z.literal("")),
  name: z.string().trim().min(3).max(180),
  sku: z.string().trim().min(3).max(80),
  specialOrder: z.boolean(),
  specifications: z.string().trim().max(4000),
  status: z.enum(["DRAFT", "PUBLISHED"])
});

const candidateReviewInput = z.object({
  brand: z.string().trim().max(100),
  candidateId: z.string().cuid(),
  category: z.string().trim().min(2).max(100)
});

const productIdInput = z.object({
  productId: z.string().cuid()
});

const bulkProductStatusInput = z.object({
  productIds: z.array(z.string().cuid()).min(1).max(100),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
});

const imageReviewInput = z.object({
  assetId: z.string().cuid(),
  decision: z.enum(["APPROVED", "REJECTED"])
});

const imageAssetInput = z.object({ assetId: z.string().cuid() });
const removeImageAssetInput = z.object({
  assetId: z.string().cuid(),
  reason: z.string().trim().max(500).optional()
});

const editableProductInput = z.object({
  brand: z.string().trim().max(100),
  category: z.string().trim().min(2).max(100),
  description: z.string().trim().min(12).max(12_000),
  name: z.string().trim().min(3).max(500),
  partNumber: z.string().trim().max(160),
  productId: z.string().cuid(),
  sku: z.string().trim().min(3).max(80),
  specialOrder: z.boolean(),
  specifications: z.string().trim().max(16_000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  supplierCostWithTax: z.string().trim().max(32),
  supplierSubcategoryId: z.string().cuid().or(z.literal("")),
  upc: z.string().trim().max(160),
  warrantyYears: z.string().trim().max(3),
  basePriceWithTax: z.string().trim().max(32),
  stockTotal: z.string().trim().max(12)
});

type CreateProductState = {
  error?: string;
  slug?: string;
  success?: string;
};

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringList(value: unknown, maximum = 16) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}

function decimalValue(value: unknown) {
  const parsed =
    typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function listingData(value: unknown) {
  const listing = asRecord(asRecord(value)?.listing);
  const supplierStock = Array.isArray(listing?.stockByLocation)
    ? listing.stockByLocation.flatMap((item) => {
        const stock = asRecord(item);
        const location = typeof stock?.location === "string" ? stock.location.trim() : "";
        const quantity = decimalValue(stock?.quantity);
        return location && quantity !== undefined ? [{ location, quantity }] : [];
      })
    : [];
  const stockByLocation = prepareSicoddStockLocations(supplierStock);
  const volumePrices = Array.isArray(listing?.wholesaleTiers)
    ? listing.wholesaleTiers.flatMap((item) => {
        const tier = asRecord(item);
        const minimumQuantity = decimalValue(tier?.minimumQuantity);
        const priceWithTax = decimalValue(tier?.priceWithTax);
        return minimumQuantity !== undefined && priceWithTax !== undefined
          ? [{ minimumQuantity, priceWithTax }]
          : [];
      })
    : [];

  return {
    basePriceWithTax: decimalValue(listing?.priceWithTax),
    stockByLocation,
    stockTotal: stockByLocation.reduce((total, location) => total + location.quantity, 0),
    supplierCostWithTax: decimalValue(listing?.costWithTax),
    volumePrices
  };
}

export async function createCatalogProduct(
  _previousState: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  const admin = await requireCurrentAdmin();
  const parsed = productInput.safeParse({
    brand: formData.get("brand") ?? "",
    category: formData.get("category"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl") ?? "",
    name: formData.get("name"),
    sku: formData.get("sku"),
    specialOrder: formData.get("specialOrder") === "on",
    specifications: formData.get("specifications") ?? "",
    status: formData.get("status")
  });
  if (!parsed.success) {
    return { error: "Revisa el producto antes de guardarlo." };
  }

  const input = parsed.data;
  const imageFrameColors = input.imageUrl
    ? await getSicoddImageFrameColors([input.imageUrl])
    : [];
  const specifications = input.specifications
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  try {
    const product = await database.$transaction(async (transaction) => {
      const created = await transaction.product.create({
        data: {
          brand: input.brand || null,
          category: input.category,
          createdById: admin.id,
          description: input.description,
          imageFrameColors: imageFrameColors.length ? imageFrameColors : undefined,
          imageUrl: input.imageUrl || null,
          name: input.name,
          sku: input.sku.toUpperCase(),
          slug: productSlug(input.name),
          specialOrder: input.specialOrder,
          specifications: specifications.length
            ? specificationsFromLines(specifications)
            : undefined,
          status: input.status
        }
      });
      await enqueueProductImages(
        transaction,
        created.id,
        created.imageUrl,
        created.galleryUrls
      );
      return created;
    });
    revalidatePath("/admin/catalogo");
    revalidatePath("/suministro");
    revalidatePath("/suministro/catalogo");
    return {
      slug: product.slug,
      success:
        input.status === "PUBLISHED"
          ? "Producto publicado sin precio publico."
          : "Producto guardado como borrador."
    };
  } catch {
    return { error: "Ese SKU ya existe o el producto no pudo guardarse." };
  }
}

export async function importSicoddCandidate(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede publicar candidatos de proveedor.");
  }
  const parsed = candidateReviewInput.safeParse({
    brand: formData.get("brand") ?? "",
    candidateId: formData.get("candidateId"),
    category: formData.get("category")
  });
  if (!parsed.success) {
    throw new Error("Revisa la categoría antes de crear la ficha.");
  }

  const candidate = await database.sicoddImportCandidate.findUnique({
    where: { id: parsed.data.candidateId }
  });
  if (!candidate || candidate.status !== "PENDING") {
    throw new Error("Este candidato ya fue revisado o dejó de estar disponible.");
  }

  const sku = (
    candidate.upc ||
    candidate.partNumber ||
    candidate.sourceKey ||
    candidate.id
  )
    .trim()
    .toUpperCase()
    .slice(0, 80);
  const existing = await database.product.findUnique({ where: { sku } });
  if (existing) {
    throw new Error("Ya existe una ficha con ese UPC, número de parte o SKU.");
  }

  const settings = await database.sicoddSyncSettings.findUnique({
    where: { id: "sicodd-primary" },
    select: { importAsDraft: true }
  });
  const galleryUrls = stringList(candidate.imageUrls);
  const imageFrameColors = await getSicoddImageFrameColors(galleryUrls);
  const specifications = Array.isArray(candidate.specifications)
    ? candidate.specifications.flatMap((item) => {
        const specification = asRecord(item);
        const label =
          typeof specification?.label === "string" ? specification.label.trim() : "";
        const value =
          typeof specification?.value === "string" ? specification.value.trim() : "";
        return label && value ? [{ label, value }] : [];
      })
    : [];
  const commercial = listingData(candidate.sourcePayload);
  const catalogCode = candidateCatalogCode(candidate.sourcePayload);
  const supplierSubcategory = catalogCode
    ? await database.sicoddCatalogSubcategory.findUnique({
        select: { id: true },
        where: { code: catalogCode }
      })
    : null;
  const name = (candidate.name || candidate.description || "PRODUCTO SICODD")
    .trim()
    .toLocaleUpperCase("es-MX")
    .slice(0, 500);

  await database.$transaction(async (transaction) => {
    const product = await transaction.product.create({
      data: {
        basePriceWithTax: commercial.basePriceWithTax,
        brand: parsed.data.brand ? parsed.data.brand.toLocaleUpperCase("es-MX") : null,
        category: parsed.data.category.toLocaleUpperCase("es-MX"),
        createdById: admin.id,
        description: (candidate.description || name).toLocaleUpperCase("es-MX"),
        imageFrameColors: imageFrameColors.length ? imageFrameColors : undefined,
        galleryUrls: galleryUrls.length ? galleryUrls : undefined,
        imageUrl: galleryUrls[0] ?? null,
        name,
        partNumber: candidate.partNumber,
        sku,
        slug: productSlug(name),
        specialOrder: commercial.stockTotal <= 0,
        specifications: specifications.length ? specifications : undefined,
        status: settings?.importAsDraft === false ? "PUBLISHED" : "DRAFT",
        stockByLocation: commercial.stockByLocation.length
          ? commercial.stockByLocation
          : undefined,
        stockTotal: commercial.stockByLocation.length ? commercial.stockTotal : null,
        stockUpdatedAt: commercial.stockByLocation.length ? new Date() : null,
        supplierCostWithTax: commercial.supplierCostWithTax,
        supplierSourceKey: candidate.sourceKey,
        supplierSourceUrl: candidate.sourceUrl,
        supplierSubcategoryId: supplierSubcategory?.id,
        upc: candidate.upc,
        volumePrices: commercial.volumePrices.length
          ? commercial.volumePrices
          : undefined,
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
        reviewedById: admin.id,
        status: "IMPORTED"
      },
      where: { id: candidate.id }
    });
  });

  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/sincronizacion");
}

export async function publishCatalogProduct(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede publicar productos.");
  }
  const parsed = productIdInput.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) {
    throw new Error("No fue posible identificar la ficha.");
  }
  const reviewedAt = new Date();
  const product = await database.$transaction(async (transaction) => {
    const updatedProduct = await transaction.product.update({
      data: { status: "PUBLISHED" },
      select: { slug: true },
      where: { id: parsed.data.productId }
    });
    await transaction.productImageDerivative.updateMany({
      data: {
        reviewedAt,
        reviewedById: admin.id,
        status: "APPROVED"
      },
      where: {
        productId: parsed.data.productId,
        status: "READY",
        storageKey: { not: null }
      }
    });
    return updatedProduct;
  });
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro");
  revalidatePath("/suministro/catalogo");
  revalidatePath(`/suministro/catalogo/${product.slug}`);
}

export async function bulkUpdateCatalogProducts(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede cambiar el estado comercial de productos.");
  }
  const parsed = bulkProductStatusInput.safeParse({
    productIds: [...new Set(formData.getAll("productIds").map(String))],
    status: formData.get("status")
  });
  if (!parsed.success) {
    throw new Error("Selecciona entre uno y 100 productos y una acción válida.");
  }

  const products = await database.product.findMany({
    select: { id: true, slug: true },
    where: { id: { in: parsed.data.productIds } }
  });
  if (!products.length) {
    throw new Error("Las fichas seleccionadas ya no están disponibles.");
  }

  await database.$transaction(async (transaction) => {
    await transaction.product.updateMany({
      data: { status: parsed.data.status },
      where: { id: { in: products.map((product) => product.id) } }
    });
    if (parsed.data.status === "PUBLISHED") {
      await transaction.productImageDerivative.updateMany({
        data: {
          reviewedAt: new Date(),
          reviewedById: admin.id,
          status: "APPROVED"
        },
        where: {
          productId: { in: products.map((product) => product.id) },
          status: "READY",
          storageKey: { not: null }
        }
      });
    }
  });

  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro");
  revalidatePath("/suministro/catalogo");
  for (const product of products) {
    revalidatePath(`/suministro/catalogo/${product.slug}`);
  }
}

export async function queueCatalogProductImages(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede iniciar procesamiento de imágenes.");
  }
  const parsed = productIdInput.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) throw new Error("No fue posible identificar la ficha.");

  const product = await database.product.findUnique({
    select: { galleryUrls: true, id: true, imageUrl: true },
    where: { id: parsed.data.productId }
  });
  if (!product) throw new Error("La ficha ya no está disponible.");
  await database.$transaction((transaction) =>
    enqueueProductImages(transaction, product.id, product.imageUrl, product.galleryUrls)
  );
  revalidatePath("/admin/catalogo");
}

export async function reprocessCatalogProductImage(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede reprocesar imágenes.");
  }
  const parsed = imageAssetInput.safeParse({ assetId: formData.get("assetId") });
  if (!parsed.success) throw new Error("No fue posible identificar la imagen.");

  const asset = await database.productImageDerivative.findUnique({
    select: {
      product: { select: { galleryUrls: true, imageUrl: true, slug: true } },
      productId: true,
      sourceUrl: true,
      sourceUrlHash: true
    },
    where: { id: parsed.data.assetId }
  });
  if (!asset) throw new Error("La imagen ya no estÃ¡ disponible para reprocesar.");
  const result = await database.$transaction(async (transaction) => {
    // Reprocess is the explicit override for an exclusion; normal syncs retain it.
    await transaction.productImageExclusion.deleteMany({
      where: { productId: asset.productId, sourceUrlHash: asset.sourceUrlHash }
    });
    const galleryUrls = [
      ...new Set(
        [
          ...(Array.isArray(asset.product.galleryUrls)
            ? asset.product.galleryUrls.filter(
                (value): value is string => typeof value === "string"
              )
            : []),
          asset.sourceUrl
        ].filter(Boolean)
      )
    ];
    await transaction.product.update({
      data: {
        galleryUrls,
        imageUrl: asset.product.imageUrl ?? asset.sourceUrl
      },
      where: { id: asset.productId }
    });
    return transaction.productImageDerivative.updateMany({
      data: {
        attempts: 0,
        failureNotifiedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: new Date(),
        processingVersion: { increment: 1 },
        reviewedAt: null,
        reviewedById: null,
        status: "PENDING"
      },
      where: {
        id: parsed.data.assetId,
        status: { in: ["APPROVED", "DEAD", "REJECTED"] }
      }
    });
  });
  if (!result.count) throw new Error("La imagen no está disponible para reprocesar.");
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro/catalogo");
  revalidatePath(`/suministro/catalogo/${asset.product.slug}`);
}

export async function reviewCatalogProductImage(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede aprobar imágenes.");
  }
  const parsed = imageReviewInput.safeParse({
    assetId: formData.get("assetId"),
    decision: formData.get("decision")
  });
  if (!parsed.success) throw new Error("La revisión de imagen no es válida.");

  const result = await database.productImageDerivative.updateMany({
    data: {
      reviewedAt: new Date(),
      reviewedById: admin.id,
      status: parsed.data.decision
    },
    where: { id: parsed.data.assetId, status: { in: ["READY", "APPROVED"] } }
  });
  if (!result.count) throw new Error("La imagen todavía no está lista para revisión.");
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro/catalogo");
}

function optionalNonNegativeNumber(value: string, maximum: number) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : undefined;
}

/** Admin editor for corrections that should not wait for the next supplier scan. */
export async function updateCatalogProduct(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const parsed = editableProductInput.safeParse({
    basePriceWithTax: formData.get("basePriceWithTax") ?? "",
    brand: formData.get("brand") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    name: formData.get("name") ?? "",
    partNumber: formData.get("partNumber") ?? "",
    productId: formData.get("productId"),
    sku: formData.get("sku") ?? "",
    specialOrder: formData.get("specialOrder") === "on",
    specifications: formData.get("specifications") ?? "",
    status: formData.get("status") ?? "DRAFT",
    stockTotal: formData.get("stockTotal") ?? "",
    supplierCostWithTax: formData.get("supplierCostWithTax") ?? "",
    supplierSubcategoryId: formData.get("supplierSubcategoryId") ?? "",
    upc: formData.get("upc") ?? "",
    warrantyYears: formData.get("warrantyYears") ?? ""
  });
  if (!parsed.success)
    throw new Error("Revisa los datos de la ficha antes de guardarla.");

  const input = parsed.data;
  const cost = optionalNonNegativeNumber(input.supplierCostWithTax, 99_999_999);
  const price = optionalNonNegativeNumber(input.basePriceWithTax, 99_999_999);
  const stock = optionalNonNegativeNumber(input.stockTotal, 1_000_000);
  const warranty = optionalNonNegativeNumber(input.warrantyYears, 100);
  if ([cost, price, stock, warranty].some((value) => value === undefined)) {
    throw new Error("Costo, precio, existencias y garantía deben ser números positivos.");
  }
  const existing = await database.product.findUnique({
    select: { slug: true, status: true },
    where: { id: input.productId }
  });
  if (!existing) throw new Error("La ficha ya no está disponible.");
  if (admin.role === "EDITOR" && input.status !== existing.status) {
    throw new Error(
      "Tu perfil puede editar la ficha, pero no cambiar su estado comercial."
    );
  }
  const specs = specificationsFromLines(
    input.specifications
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
  await database.$transaction(async (transaction) => {
    await transaction.product.update({
      data: {
        basePriceWithTax: price,
        brand: input.brand ? input.brand.toLocaleUpperCase("es-MX") : null,
        category: input.category.toLocaleUpperCase("es-MX"),
        description: input.description.toLocaleUpperCase("es-MX"),
        name: input.name.toLocaleUpperCase("es-MX"),
        partNumber: input.partNumber ? input.partNumber.toLocaleUpperCase("es-MX") : null,
        sku: input.sku.toLocaleUpperCase("es-MX"),
        specialOrder: input.specialOrder,
        specifications: specs.length ? specs : Prisma.JsonNull,
        status: admin.role === "EDITOR" ? existing.status : input.status,
        stockTotal: stock === null ? null : Math.trunc(stock ?? 0),
        stockUpdatedAt: stock === null ? null : new Date(),
        supplierCostWithTax: cost,
        supplierSubcategoryId: input.supplierSubcategoryId || null,
        upc: input.upc ? input.upc.toLocaleUpperCase("es-MX") : null,
        warrantyYears: warranty === null ? null : Math.trunc(warranty ?? 0)
      },
      where: { id: input.productId }
    });
    if (admin.role !== "EDITOR" && input.status === "PUBLISHED") {
      await transaction.productImageDerivative.updateMany({
        data: { reviewedAt: new Date(), reviewedById: admin.id, status: "APPROVED" },
        where: { productId: input.productId, status: "READY", storageKey: { not: null } }
      });
    }
  });
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro");
  revalidatePath("/suministro/catalogo");
  revalidatePath(`/suministro/catalogo/${existing.slug}`);
}

/**
 * Removes an image from the public gallery and retains a URL tombstone. A future
 * supplier scan therefore cannot silently queue the discarded image again.
 */
export async function removeCatalogProductImage(formData: FormData) {
  const admin = await requireCurrentAdmin();
  if (admin.role === "EDITOR") {
    throw new Error("Tu perfil no puede eliminar recursos del catÃ¡logo.");
  }
  const parsed = removeImageAssetInput.safeParse({
    assetId: formData.get("assetId"),
    reason: formData.get("reason") ?? undefined
  });
  if (!parsed.success)
    throw new Error("No fue posible identificar la imagen a eliminar.");

  const asset = await database.productImageDerivative.findUnique({
    include: {
      product: { select: { galleryUrls: true, id: true, imageUrl: true, slug: true } }
    },
    where: { id: parsed.data.assetId }
  });
  if (!asset) throw new Error("La imagen ya no estÃ¡ disponible.");

  const galleryUrls = Array.isArray(asset.product.galleryUrls)
    ? asset.product.galleryUrls.filter(
        (item): item is string => typeof item === "string" && item !== asset.sourceUrl
      )
    : [];
  const primaryImage =
    asset.product.imageUrl === asset.sourceUrl
      ? (galleryUrls[0] ?? null)
      : asset.product.imageUrl;
  await database.$transaction(async (transaction) => {
    await transaction.productImageExclusion.upsert({
      create: {
        createdById: admin.id,
        productId: asset.productId,
        reason: parsed.data.reason || "ELIMINADA DESDE CONTROL DE CATÃLOGO",
        sourceContentHash: asset.sourceHash,
        sourceUrl: asset.sourceUrl,
        sourceUrlHash: asset.sourceUrlHash
      },
      update: {
        createdById: admin.id,
        reason: parsed.data.reason || "ELIMINADA DESDE CONTROL DE CATÃLOGO",
        sourceContentHash: asset.sourceHash
      },
      where: {
        productId_sourceUrlHash: {
          productId: asset.productId,
          sourceUrlHash: asset.sourceUrlHash
        }
      }
    });
    await transaction.product.update({
      data: { galleryUrls, imageUrl: primaryImage },
      where: { id: asset.productId }
    });
    await transaction.productImageDerivative.update({
      data: {
        reviewedAt: new Date(),
        reviewedById: admin.id,
        status: "REJECTED"
      },
      where: { id: asset.id }
    });
  });
  if (asset.storageKey) {
    await removeProductImageStorageKey(asset.storageKey).catch(() => undefined);
  }
  revalidatePath("/admin/catalogo");
  revalidatePath("/suministro");
  revalidatePath("/suministro/catalogo");
  revalidatePath(`/suministro/catalogo/${asset.product.slug}`);
}
