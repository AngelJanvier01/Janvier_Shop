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

export function getProductGallery(imageUrl: string | null, galleryUrls: unknown) {
  return [
    ...new Set([imageUrl, ...getStringList(galleryUrls)].filter(Boolean) as string[])
  ];
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
