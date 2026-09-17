export type SicoddStockLocation = {
  location: string;
  quantity: number | null;
};

function normalizeLocation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleUpperCase("es-MX");
}

export function configuredPublicWarehouses(value = process.env.SICODD_PUBLIC_WAREHOUSES) {
  return new Set(
    (value ?? "")
      .split(",")
      .map(normalizeLocation)
      .filter(Boolean)
  );
}

/**
 * Prevents supplier-only warehouse names and quantities from reaching the public catalog.
 * When external warehouses are disabled, only the explicit allowlist is retained.
 */
export function filterSicoddStockLocations(
  locations: SicoddStockLocation[],
  includeExternalWarehouses: boolean,
  publicWarehouses = configuredPublicWarehouses()
) {
  if (includeExternalWarehouses) return locations;
  if (!publicWarehouses.size) return [];
  return locations.filter((item) => publicWarehouses.has(normalizeLocation(item.location)));
}
