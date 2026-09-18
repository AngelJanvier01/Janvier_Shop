import { database } from "@/lib/database";
import {
  normalizeSicoddStockLocationName,
  prepareSicoddStockLocations,
  type SicoddStockLocation
} from "@/lib/sicodd/stock-locations";

export function defaultSicoddWarehouseNickname(sourceName: string) {
  const compact = sourceName.trim().replace(/\s+/gu, " ");
  return compact.replace(/^(?:DICOTECH|MODAMOB)\s+/iu, "").slice(0, 100) || compact;
}

export async function recordSicoddWarehouses(
  locations: SicoddStockLocation[],
  lastSeenAt = new Date()
) {
  const prepared = prepareSicoddStockLocations(locations);
  await Promise.all(
    prepared.map((location) => {
      const normalizedName = normalizeSicoddStockLocationName(location.location);
      return database.sicoddWarehouse.upsert({
        create: {
          lastSeenAt,
          nickname: defaultSicoddWarehouseNickname(location.location),
          normalizedName,
          sourceName: location.location
        },
        update: { lastSeenAt, sourceName: location.location },
        where: { normalizedName }
      });
    })
  );
}
