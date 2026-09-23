import { getProductSourceGallery } from "./catalog";
import { extractProductSpecifications } from "./product-specifications";

export type CatalogQualityIssueCode =
  | "BRAND"
  | "CATEGORY"
  | "DESCRIPTION"
  | "SPECIFICATIONS"
  | "SOURCE_IMAGE"
  | "IMAGE_QUEUE"
  | "IMAGE_REVIEW"
  | "IMAGE_FAILED"
  | "PRICE"
  | "IDENTITY";

export type CatalogQualityProduct = {
  basePriceWithTax: { toString(): string } | number | null;
  brand: string | null;
  catalogReviewApproved: boolean;
  category: string;
  description: string;
  galleryUrls: unknown;
  imageDerivatives: Array<{ sourceUrl: string; status: string }>;
  imageUrl: string | null;
  name: string;
  sku: string;
  specifications: unknown;
  supplierCostWithTax: { toString(): string } | number | null;
  supplierSourceUrl: string | null;
  supplierSubcategoryId: string | null;
};

export const catalogQualityLabels: Record<CatalogQualityIssueCode, string> = {
  BRAND: "MARCA SIN CONFIRMAR",
  CATEGORY: "CLASIFICACIÓN POR REVISAR",
  DESCRIPTION: "DESCRIPCIÓN BREVE",
  SPECIFICATIONS: "SIN CARACTERÍSTICAS",
  SOURCE_IMAGE: "SIN FOTO DE ORIGEN",
  IMAGE_QUEUE: "FOTO SIN PROCESAR",
  IMAGE_REVIEW: "FOTO POR APROBAR",
  IMAGE_FAILED: "FOTO CON INCIDENCIA",
  PRICE: "PRECIO POR REVISAR",
  IDENTITY: "IDENTIDAD INVÁLIDA"
};

export function assessCatalogQuality(product: CatalogQualityProduct) {
  const issues: CatalogQualityIssueCode[] = [];
  const supplierProduct = Boolean(product.supplierSourceUrl);
  if (!product.brand?.trim()) issues.push("BRAND");
  if (
    !product.category.trim() ||
    product.category.trim().toLocaleUpperCase("es-MX") === "PRODUCTOS SICODD" ||
    (supplierProduct && !product.supplierSubcategoryId)
  ) issues.push("CATEGORY");
  if (
    product.description.trim().length <=
    Math.max(product.name.trim().length + 12, 80)
  ) issues.push("DESCRIPTION");
  if (!extractProductSpecifications(product.specifications).length) {
    issues.push("SPECIFICATIONS");
  }
  const price = Number(product.basePriceWithTax?.toString() ?? NaN);
  const cost = Number(product.supplierCostWithTax?.toString() ?? NaN);
  if (!Number.isFinite(price) || price <= 0 || (Number.isFinite(cost) && price < cost)) {
    issues.push("PRICE");
  }
  if (/^\/ADMIN\//iu.test(product.sku) || /^(?:DESCARGAR CSV|FAMILIAS|\d+ PRODUCTOS)$/iu.test(product.name.trim())) {
    issues.push("IDENTITY");
  }

  const gallery = getProductSourceGallery(product.imageUrl, product.galleryUrls);
  const currentUrls = new Set(gallery);
  const currentImages = product.imageDerivatives.filter((image) => currentUrls.has(image.sourceUrl));
  const processing = currentImages.some((image) =>
    ["PENDING", "PROCESSING", "RETRY"].includes(image.status)
  );
  if (!gallery.length) issues.push("SOURCE_IMAGE");
  else {
    if (gallery.some((url) => !currentImages.some((image) => image.sourceUrl === url))) {
      issues.push("IMAGE_QUEUE");
    }
    if (currentImages.some((image) => image.status === "READY")) issues.push("IMAGE_REVIEW");
    if (currentImages.some((image) => ["REJECTED", "DEAD"].includes(image.status))) {
      issues.push("IMAGE_FAILED");
    }
  }

  return {
    issues,
    processing,
    reviewed: product.catalogReviewApproved && issues.length > 0,
    needsReview: issues.length > 0 && !product.catalogReviewApproved
  };
}
