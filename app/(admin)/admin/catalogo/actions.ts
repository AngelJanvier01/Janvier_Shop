"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { specificationsFromLines } from "@/lib/commerce/product-specifications";
import { database } from "@/lib/database";
import { enqueueProductImages } from "@/lib/product-images/queue";
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

const imageReviewInput = z.object({
  assetId: z.string().cuid(),
  decision: z.enum(["APPROVED", "REJECTED"])
});

const imageAssetInput = z.object({ assetId: z.string().cuid() });

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

  const result = await database.productImageDerivative.updateMany({
    data: {
      attempts: 0,
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
  if (!result.count) throw new Error("La imagen no está disponible para reprocesar.");
  revalidatePath("/admin/catalogo");
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
