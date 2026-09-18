export type SicoddStockLocation = {
  location: string;
  quantity: number | null;
};

export function normalizeSicoddStockLocationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleUpperCase("es-MX");
}

export function prepareSicoddStockLocations(locations: SicoddStockLocation[]) {
  const stockByKey = new Map<string, { location: string; quantity: number }>();

  for (const item of locations) {
    const location = item.location.trim().replace(/\s+/gu, " ").slice(0, 160);
    const key = normalizeSicoddStockLocationName(location);
    if (!key || typeof item.quantity !== "number" || !Number.isFinite(item.quantity)) {
      continue;
    }
    const quantity = Math.max(0, Math.trunc(item.quantity));
    const current = stockByKey.get(key);
    stockByKey.set(key, {
      location: current?.location ?? location,
      quantity: (current?.quantity ?? 0) + quantity
    });
  }

  return [...stockByKey.values()];
}

export function sicoddStockTotal(locations: SicoddStockLocation[]) {
  return prepareSicoddStockLocations(locations).reduce(
    (total, location) => total + location.quantity,
    0
  );
}
