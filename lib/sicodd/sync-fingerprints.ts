import { createHash } from "node:crypto";

import { productImageSourceHash } from "@/lib/product-images/queue";

function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value.trim());
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

/** A repeatable hash so unchanged supplier payloads do not create repeat work. */
export function sicoddContentHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function uniqueSupplierImageUrls(value: readonly string[]) {
  const seen = new Set<string>();
  return value.filter((item) => {
    const url = item.trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function withoutExcludedSupplierImages(
  imageUrls: readonly string[],
  excludedSourceUrlHashes: ReadonlySet<string>
) {
  return uniqueSupplierImageUrls(imageUrls).filter(
    (url) => !excludedSourceUrlHashes.has(productImageSourceHash(url))
  );
}

export function decimalText(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric.toFixed(2) : null;
}

export function sameDecimal(left: unknown, right: unknown) {
  return decimalText(left) === decimalText(right);
}
