export type ProductStockLocation = {
  location: string;
  quantity: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberValue(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : value && typeof value === "object" && "toString" in value
          ? Number(String(value))
          : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function getStringList(value: unknown, maximum = 16) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}

/**
 * An image which may be displayed in the storefront.  During a quality
 * reprocess we retain the already-reviewed local rendition while the next
 * version is being produced; first-time, unreviewed derivatives are never
 * included here.
 */
export type DisplayableImageDerivative = {
  id: string;
  processingVersion: number;
  sourceUrl: string;
  // The database query narrows this to public-safe states. Keeping the
  // database enum assignable here prevents callers from needing unsafe casts.
  status: string;
};

export function getProductSourceGallery(imageUrl: string | null, galleryUrls: unknown) {
  return [
    ...new Set([imageUrl, ...getStringList(galleryUrls)].filter(Boolean) as string[])
  ];
}

/**
 * The public storefront deliberately has no supplier-image fallback. A source
 * image is only shown after our local derivative has passed processing and
 * approval, keeping availability and visual treatment under JANVIER control.
 */
export function getProductGallery(
  imageUrl: string | null,
  galleryUrls: unknown,
  displayableDerivatives: DisplayableImageDerivative[] = []
) {
  const originalImages = getProductSourceGallery(imageUrl, galleryUrls);
  const derivativeBySource = new Map(
    displayableDerivatives.map((derivative) => [
      derivative.sourceUrl,
      `/api/product-images/${derivative.id}/webp?v=${
        derivative.status === "APPROVED"
          ? derivative.processingVersion
          : Math.max(1, derivative.processingVersion - 1)
      }`
    ])
  );
  return originalImages.flatMap((sourceUrl) => {
    const derivative = derivativeBySource.get(sourceUrl);
    return derivative ? [derivative] : [];
  });
}

export function getProductImageFrameColors(
  imageUrl: string | null,
  galleryUrls: unknown,
  imageFrameColors: unknown,
  displayableDerivatives: DisplayableImageDerivative[] = []
) {
  const sourceGallery = getProductSourceGallery(imageUrl, galleryUrls);
  const displayableSources = new Set(
    displayableDerivatives.map((item) => item.sourceUrl)
  );
  const colors = getStringList(imageFrameColors, sourceGallery.length).map((color) =>
    isImageFrameColor(color) ? color.toUpperCase() : fallbackImageFrameColor
  );
  return sourceGallery.flatMap((sourceUrl, index) =>
    displayableSources.has(sourceUrl) ? [colors[index] ?? fallbackImageFrameColor] : []
  );
}

export function getStockLocations(value: unknown, maximum = 20): ProductStockLocation[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const record = asRecord(item);
      const location = typeof record?.location === "string" ? record.location.trim() : "";
      const quantity = numberValue(record?.quantity);
      return location && quantity !== null
        ? [{ location, quantity: Math.max(0, quantity) }]
        : [];
    })
    .slice(0, maximum);
}

export function getAccountPriceWithTax(
  basePriceWithTax: unknown,
  discountPercentage: unknown
) {
  const basePrice = numberValue(basePriceWithTax);
  if (basePrice === null || basePrice < 0) return null;
  const discount = numberValue(discountPercentage) ?? 0;
  const normalizedDiscount = Math.min(Math.max(discount, 0), 100);
  return Math.round(basePrice * (1 - normalizedDiscount / 100) * 100) / 100;
}

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});

export function formatMxn(value: number | null) {
  return value === null ? "PRECIO A CONFIRMAR" : mxnFormatter.format(value);
}
import {
  fallbackImageFrameColor,
  isImageFrameColor
} from "@/lib/commerce/image-frame-color";
