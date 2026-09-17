import { resolve } from "node:path";

const defaultStoragePath = "/var/lib/janvier/product-images";

export function productImageConfiguration() {
  const sourceHosts = new Set(
    (process.env.PRODUCT_IMAGE_SOURCE_HOSTS ?? "janvier01.sicodd.com.mx")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
  const maximumSourceBytes = Number(
    process.env.PRODUCT_IMAGE_MAX_SOURCE_BYTES ?? 20_971_520
  );

  return {
    processorUrl:
      process.env.BACKGROUND_REMOVAL_URL?.trim() || "http://background-removal:8080",
    sourceHosts,
    maximumSourceBytes:
      Number.isSafeInteger(maximumSourceBytes) && maximumSourceBytes > 0
        ? maximumSourceBytes
        : 20_971_520,
    storagePath: resolve(
      process.env.PRODUCT_IMAGE_STORAGE_PATH?.trim() || defaultStoragePath
    ),
    workerEnabled: process.env.PRODUCT_IMAGE_WORKER_ENABLED === "true"
  };
}
