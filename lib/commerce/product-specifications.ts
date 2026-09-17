export type ProductSpecification = { label: string; value: string };

export function extractProductSpecifications(value: unknown): ProductSpecification[] {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>).items
      : value;
  if (!Array.isArray(source)) return [];

  return source.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [{ label: "DETALLE", value: item.trim() }];
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const fieldValue = typeof record.value === "string" ? record.value.trim() : "";
    return label && fieldValue ? [{ label, value: fieldValue }] : [];
  });
}

export function specificationsFromLines(lines: string[]) {
  return lines.map((value) => ({ label: "DETALLE", value }));
}
