import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

import { productImageConfiguration } from "./config";

const variants = new Set(["png", "webp", "avif"]);

function assertStoragePath(path: string) {
  const root = productImageConfiguration().storagePath;
  const resolved = resolve(path);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error("PRODUCT_IMAGE_STORAGE_PATH_INVALID");
  }
  return resolved;
}

export function productImageStorageKey(
  assetId: string,
  sourceHash: string,
  processingVersion: number
) {
  return join(assetId, `v${processingVersion}-${sourceHash.slice(0, 16)}`);
}

export function productImageVariantPath(storageKey: string, variant: string) {
  if (!variants.has(variant) || extname(storageKey)) {
    throw new Error("PRODUCT_IMAGE_VARIANT_INVALID");
  }
  return assertStoragePath(
    join(productImageConfiguration().storagePath, storageKey, `image.${variant}`)
  );
}

export async function writeProductImageVariant(
  storageKey: string,
  variant: "png" | "webp" | "avif",
  contents: Buffer
) {
  const target = productImageVariantPath(storageKey, variant);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: "wx", mode: 0o640 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export function readProductImageVariant(storageKey: string, variant: string) {
  return readFile(productImageVariantPath(storageKey, variant));
}

export async function removeProductImageStorageKey(storageKey: string) {
  const target = assertStoragePath(
    join(productImageConfiguration().storagePath, storageKey)
  );
  await rm(target, { force: true, recursive: true });
}
