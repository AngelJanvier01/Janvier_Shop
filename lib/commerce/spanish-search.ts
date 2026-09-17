function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function addSingularAndPluralForms(variants: Set<string>, word: string) {
  if (word.length < 3 || !/^\p{L}+$/u.test(word)) return;

  if (word.endsWith("CES")) {
    variants.add(`${word.slice(0, -3)}Z`);
  }

  if (word.endsWith("S")) {
    variants.add(word.slice(0, -1));
    if (word.endsWith("ES")) variants.add(word.slice(0, -2));
    return;
  }

  variants.add(`${word}S`);
  variants.add(`${word}ES`);
  if (word.endsWith("Z")) variants.add(`${word.slice(0, -1)}CES`);
}

/**
 * Makes ordinary Spanish singular/plural searches equivalent without a third-party
 * service. Terms with digits or punctuation (SKU, UPC and part numbers) keep their
 * literal variant, so product identifiers remain exact and predictable.
 */
export function getSpanishSearchVariants(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const upper = trimmed.toLocaleUpperCase("es-MX");
  const compact = upper.replace(/[^\p{L}\p{N}]/gu, "");
  const variants = new Set([
    upper,
    compact,
    stripDiacritics(upper),
    stripDiacritics(compact)
  ]);

  addSingularAndPluralForms(variants, upper);
  addSingularAndPluralForms(variants, stripDiacritics(upper));

  return [...variants].filter((variant) => variant.length > 1).slice(0, 12);
}
