type AnchorLink = {
  href: string;
  label: string;
};

export type SicoddProductCandidate = {
  brand: string | null;
  description: string | null;
  imageUrls: string[];
  name: string | null;
  partNumber: string | null;
  sourceKey: string | null;
  sourcePayload: Record<string, string>;
  specifications: Array<{ label: string; value: string }>;
  upc: string | null;
  warrantyYears: number | null;
};

export const sicoddParserVersion = "2026-09-product-brand-v6";

const genericProductNames = [
  /^\d+\s+PRODUCTOS?$/i,
  /^CAT[AÁ]LOGO$/i,
  /^CARACTER[IÍ]STICAS(?:\s+PRINCIPALES)?$/i,
  /^DESCARGAR\s+CSV$/i,
  /^ESPECIFICACIONES?(?:\s+T[EÉ]CNICAS?)?$/i,
  /^FAMILIAS?$/i,
  /^FICHA\s+T[EÉ]CNICA$/i,
  /^INCLUYE$/i,
  /^INFORMACI[OÓ]N\s+ADICIONAL$/i,
  /^INFORMACI[OÓ]N\s+T[EÉ]CNICA$/i,
  /^PAR[AÁ]METROS\s+DEL\s+PRODUCTO:?$/i,
  /^PRINCIPALES\s+CARACTER[IÍ]STICAS$/i,
  /^PRODUCTOS?$/i,
  /^RENDIMIENTO$/i,
  /^VENTAJAS\s+PRINCIPALES$/i
];

const knownBrands = [
  "ADATA",
  "ACTECK",
  "AMD",
  "ANTEC",
  "AOC",
  "APC",
  "APPLE",
  "ASROCK",
  "ASUS",
  "BALAM RUSH",
  "BENQ",
  "BROTHER",
  "CANON",
  "CDP",
  "CISCO",
  "CORSAIR",
  "COMPUCARE",
  "DAHUA",
  "DELL",
  "EATON",
  "EPSON",
  "EZVIZ",
  "GENIUS",
  "GHIA",
  "GIGABYTE",
  "HIKVISION",
  "HILOOK",
  "HONEYWELL",
  "HP",
  "HPE",
  "HUAWEI",
  "HYPERX",
  "IMOU",
  "INTEL",
  "INTELLINET",
  "KASPERSKY",
  "KINGSTON",
  "KOBLENZ",
  "LENOVO",
  "LG",
  "LINKSYS",
  "LOGITECH",
  "MANHATTAN",
  "MERCUSYS",
  "MIKROTIK",
  "MODAMOB",
  "MSI",
  "NEXTEP",
  "ORAIMO",
  "PERFECT CHOICE",
  "QNAP",
  "RAZER",
  "RUIJIE",
  "SAMSUNG",
  "SANDISK",
  "SEAGATE",
  "SAXXON",
  "SILIMEX",
  "SMARTBITT",
  "STARTECH",
  "STYLOS",
  "SYNOLOGY",
  "TARGUS",
  "THERMALTAKE",
  "TIGRE",
  "TP-LINK",
  "TRIPP LITE",
  "UBIQUITI",
  "UGREEN",
  "VORAGO",
  "WESTERN DIGITAL",
  "XEROX",
  "X-CASE",
  "XCASE",
  "XMEDIA",
  "XIAOMI",
  "XPG",
  "XZEAL",
  "ZEBRA",
  "ZKTECO"
].sort((left, right) => right.length - left.length);

export type SicoddProductLink = {
  costWithTax: string | null;
  href: string;
  label: string;
  marginMultiplier: string | null;
  priceWithTax: string | null;
  stockByLocation: Array<{ location: string; quantity: number | null }>;
  supplierBrand?: string | null;
  supplierPartNumber?: string | null;
  wholesaleTiers: Array<{ minimumQuantity: number; priceWithTax: string }>;
};

export type SicoddCatalogSubcategory = {
  code: string;
  name: string;
};

export type SicoddCatalogFamily = {
  code: string;
  name: string;
  subcategories: SicoddCatalogSubcategory[];
};

export type SicoddCsvProduct = {
  brand: string | null;
  catalogKey: string;
  costWithTax: string | null;
  label: string;
  partNumber: string | null;
  stockTotal: number | null;
  upc: string;
};

const ignoredAsset =
  /(?:logo|icon|sprite|loading|blank|facebook|twitter|instagram|cart|close)/i;

function decodeHtml(value: string) {
  return value
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, entity: string) => {
      const code = entity.toLowerCase().startsWith("x")
        ? Number.parseInt(entity.slice(1), 16)
        : Number.parseInt(entity, 10);
      return Number.isSafeInteger(code) ? String.fromCodePoint(code) : " ";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function cleanSicoddText(value: string) {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function isValidSicoddProductName(value: string | null | undefined) {
  const name = value?.trim() ?? "";
  return name.length >= 3 && !genericProductNames.some((pattern) => pattern.test(name));
}

function normalizedBrand(value: string) {
  return cleanSicoddText(value)
    .replace(/\s+COMPATIBLE\s+CON\s+.+$/iu, "")
    .replace(/[|;,].*$/u, "")
    .trim()
    .slice(0, 100)
    .toLocaleUpperCase("es-MX");
}

export function inferSicoddBrand(
  name: string | null | undefined,
  specifications: Array<{ label: string; value: string }>
) {
  const explicit = specifications.find(({ label }) =>
    /^(?:MARCA|FABRICANTE)$/iu.test(
      label.trim()
    )
  );
  if (explicit) {
    const brand = normalizedBrand(explicit.value);
    if (brand && brand.length >= 2) return brand;
  }

  const normalizedName = ` ${(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleUpperCase("es-MX")
    .replace(/[^A-Z0-9]+/gu, " ")} `;
  // For compatible consumables, the printer brand can appear later in the title.
  if (normalizedName.includes(" TIGRE ")) return "TIGRE";
  return (
    knownBrands.find((brand) => {
      const token = brand.replace(/[^A-Z0-9]+/gu, " ");
      return normalizedName.includes(` ${token} `);
    }) ?? null
  );
}

function taxonomyLabel(value: string) {
  return cleanSicoddText(value)
    .replace(/\s*\([A-Z0-9]+\)\s*$/i, "")
    .trim();
}

/**
 * Reads the supplier's family accordion without relying on a hard-coded catalog.
 * SICODD stores each stable key in the onclick handler that updates #clave.
 */
export function extractSicoddCatalogTaxonomy(html: string): SicoddCatalogFamily[] {
  const families = new Map<string, SicoddCatalogFamily>();
  const blocks = /<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<div\b[^>]*>([\s\S]*?)<\/div>/gi;

  for (const block of html.matchAll(blocks)) {
    const heading = cleanSicoddText(block[1] ?? "");
    const headingMatch = heading.match(/^(.*?)\s*\(([A-Z0-9]+)\)\s*$/i);
    if (!headingMatch) continue;
    const familyCode = headingMatch[2].toUpperCase();
    const familyName = headingMatch[1].trim();
    if (!familyCode || !familyName) continue;

    const subcategories = new Map<string, SicoddCatalogSubcategory>();
    for (const anchor of (block[2] ?? "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const attributes = decodeHtml(anchor[1] ?? "");
      const code = attributes.match(/\.val\(\s*['"]([^'"]+)['"]\s*\)/i)?.[1]?.trim();
      const name = taxonomyLabel(anchor[2] ?? "");
      if (
        !code ||
        code.toUpperCase() === familyCode ||
        !name ||
        /^ver\s+familia\s+completa$/i.test(name)
      ) {
        continue;
      }
      subcategories.set(code.toUpperCase(), { code: code.toUpperCase(), name });
    }

    if (!subcategories.size) continue;
    families.set(familyCode, {
      code: familyCode,
      name: familyName,
      subcategories: [...subcategories.values()]
    });
  }

  return [...families.values()];
}

function readAttribute(attributes: string, attribute: string) {
  const match = attributes.match(
    new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function sameOriginAdminUrl(href: string, pageUrl: string) {
  try {
    const page = new URL(pageUrl);
    const url = new URL(decodeHtml(href), page);
    if (url.origin !== page.origin || !url.pathname.startsWith("/admin")) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function allAnchors(html: string, pageUrl: string) {
  const anchors: AnchorLink[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = readAttribute(match[1] ?? "", "href");
    const url = href ? sameOriginAdminUrl(href, pageUrl) : null;
    if (!url) continue;
    anchors.push({ href: url, label: cleanSicoddText(match[2] ?? "").slice(0, 220) });
  }
  return anchors;
}

function enclosingTableRow(html: string, position: number) {
  const rowStart = html.lastIndexOf("<tr", position);
  if (rowStart < 0) return null;
  const rowTags = /<\/?tr\b[^>]*>/gi;
  rowTags.lastIndex = rowStart;
  let depth = 0;
  for (let tag = rowTags.exec(html); tag; tag = rowTags.exec(html)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(rowStart, tag.index + tag[0].length);
  }
  return null;
}

function topLevelTableCells(row: string) {
  const cells: string[] = [];
  const cellTags = /<\/?t[dh]\b[^>]*>/gi;
  let depth = 0;
  let contentStart: number | null = null;
  for (let tag = cellTags.exec(row); tag; tag = cellTags.exec(row)) {
    if (!tag[0].startsWith("</")) {
      if (depth === 0) contentStart = tag.index + tag[0].length;
      depth += 1;
      continue;
    }
    depth -= 1;
    if (depth === 0 && contentStart !== null) {
      cells.push(row.slice(contentStart, tag.index));
      contentStart = null;
    }
  }
  return cells;
}

function moneyValue(value: string | undefined) {
  const match = value?.match(/\$\s*([\d,.]+)/);
  return match?.[1]?.replace(/,/g, "") ?? null;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const finishField = () => {
    row.push(field);
    field = "";
  };
  const finishRow = () => {
    finishField();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field.length || row.length) finishRow();
  return rows;
}

/**
 * The supplier UI caps many category views at 30 rows. Its CSV export is used
 * only as a complete discovery index; every discovered UPC is then looked up
 * in the HTML catalog so price, margin and per-warehouse stock remain verified.
 */
export function extractSicoddCsvProducts(csv: string): SicoddCsvProduct[] {
  const products = new Map<string, SicoddCsvProduct>();
  for (const fields of parseCsvRows(csv)) {
    if (fields.length < 8) continue;
    const catalogKey = cleanSicoddText(fields[1] ?? "").toUpperCase();
    const upc = cleanSicoddText(fields[2] ?? "").toUpperCase();
    const label = cleanSicoddText(fields[3] ?? "");
    const rawBrand = cleanSicoddText(fields[4] ?? "");
    const rawStock = cleanSicoddText(fields[5] ?? "");
    const stockTotal = /^-?\d+$/u.test(rawStock) ? Number.parseInt(rawStock, 10) : null;
    if (!catalogKey || !upc || !isValidSicoddProductName(label)) continue;
    products.set(upc, {
      brand: /^(?:GEN[EÉ]RICO|N\/?A|SIN\s+MARCA|VARIAS?)$/iu.test(rawBrand)
        ? null
        : rawBrand || null,
      catalogKey,
      costWithTax: cleanSicoddText(fields[7] ?? "").replace(/,/g, "") || null,
      label,
      partNumber: cleanSicoddText(fields[6] ?? "") || null,
      stockTotal,
      upc
    });
  }
  return [...products.values()];
}

function configuredStockLocations(html: string) {
  const locations: string[] = [];
  for (const match of html.matchAll(/<td\b([^>]*)>/gi)) {
    const attributes = match[1] ?? "";
    if (!/width\s*:\s*14/i.test(attributes)) continue;
    const location = readAttribute(attributes, "title");
    if (location && !locations.includes(location)) locations.push(location);
  }
  return locations;
}

function listingMetadata(
  html: string,
  href: string
): Omit<SicoddProductLink, "href"> | null {
  const relativeHref = `${new URL(href).pathname}${new URL(href).search}`;
  const linkPosition = html.indexOf(relativeHref);
  if (linkPosition < 0) return null;
  const row = enclosingTableRow(html, linkPosition);
  if (!row) return null;
  const cells = topLevelTableCells(row);
  if (cells.length < 3) return null;

  const description = cleanSicoddText(cells[2] ?? "");
  const wholesaleText = cleanSicoddText(cells[4] ?? "");
  const wholesaleTiers = [
    ...wholesaleText.matchAll(/(\d+)\s*Pzs\.\s*\$\s*([\d,.]+)/gi)
  ].map((tier) => ({
    minimumQuantity: Number.parseInt(tier[1], 10),
    priceWithTax: tier[2].replace(/,/g, "")
  }));
  const stockValues = (cleanSicoddText(cells[6] ?? "").match(/-?\d+/g) ?? []).map(
    (value) => Number.parseInt(value, 10)
  );
  const stockByLocation = configuredStockLocations(html).map((location, index) => ({
    location,
    quantity: stockValues[index] ?? null
  }));

  return {
    costWithTax: moneyValue(cleanSicoddText(cells[4] ?? "")),
    label: description,
    marginMultiplier: cleanSicoddText(cells[3] ?? "") || null,
    priceWithTax: moneyValue(cleanSicoddText(cells[5] ?? "")),
    stockByLocation,
    wholesaleTiers
  };
}

export function extractInternalAdminLinks(html: string, pageUrl: string) {
  const links = new Map<string, AnchorLink>();
  for (const anchor of allAnchors(html, pageUrl)) {
    if (!links.has(anchor.href)) links.set(anchor.href, anchor);
  }
  return [...links.values()].slice(0, 120);
}

export function extractProductEntries(
  html: string,
  pageUrl: string
): SicoddProductLink[] {
  const currentUrl = new URL(pageUrl).toString();
  const productHint =
    /(?:producto|product|ficha|detalle|articulo|art[ií]culo|part[e]?|modelo|sku|upc)/i;
  const exclusions =
    /(?:diccionario|configuracion|usuarios|cotizaciones|proveedor|logout|salir|carrito)/i;
  const links = new Map<string, string>();

  for (const anchor of allAnchors(html, pageUrl)) {
    if (anchor.href === currentUrl || exclusions.test(`${anchor.href} ${anchor.label}`))
      continue;
    if (!productHint.test(`${anchor.href} ${anchor.label}`)) continue;
    if (!links.has(anchor.href)) links.set(anchor.href, anchor.label);
  }
  const candidates = [...links.entries()]
    .filter(([href]) => {
      const url = new URL(href);
      return /\/(?:ficha|detalle)(?:\/|$)/iu.test(url.pathname);
    })
    .map(([href, label]) => ({
      costWithTax: null,
      href,
      label,
      marginMultiplier: null,
      priceWithTax: null,
      stockByLocation: [],
      wholesaleTiers: []
    }));
  return candidates.map((candidate) => ({
    ...candidate,
    ...(listingMetadata(html, candidate.href) ?? {})
  }));
}

export function extractProductLinks(html: string, pageUrl: string) {
  return extractProductEntries(html, pageUrl).map(({ href, label }) => ({ href, label }));
}

function firstTagText(html: string, selectors: string[]) {
  for (const selector of selectors) {
    const match = html.match(
      new RegExp(`<${selector}\\b[^>]*>([\\s\\S]*?)<\\/${selector}>`, "i")
    );
    const value = match ? cleanSicoddText(match[1]) : "";
    if (value) return value;
  }
  return null;
}

function findInlineValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(
      `${escaped}\\s*:\\s*(.{1,180}?)(?=\\s+(?:NO\\s*PARTE|GARANT[IÍ]A|UPC|SKU|MODELO|DESCRIPCI[OÓ]N)\\s*:|$)`,
      "i"
    )
  );
  return match?.[1]?.trim() || null;
}

function productDetailHtml(html: string) {
  const gallery = html.match(
    /<ul\b[^>]*\bid\s*=\s*(?:"ficha_galeria"|'ficha_galeria')[^>]*>/i
  );
  if (gallery?.index === undefined) return html;
  const row = enclosingTableRow(html, gallery.index);
  if (!row) return html;
  const cells = topLevelTableCells(row);
  return cells[1] ?? html;
}

function extractTableSpecifications(html: string) {
  const entries: Array<{ label: string; value: string }> = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanSicoddText(cell[1] ?? ""))
      .filter(Boolean);
    if (cells.length < 2) continue;
    const [label, ...values] = cells;
    const value = values.join(" · ");
    if (/^(?:NO\s*PARTE|GARANT[IÍ]A|UPC)\b/i.test(label)) continue;
    if (label.length <= 180 && value.length <= 1000) entries.push({ label, value });
  }
  return entries.slice(0, 80);
}

type NarrativeBlock = {
  kind: "heading" | "item" | "paragraph";
  value: string;
};

function extractNarrativeBlocks(html: string) {
  const blocks: NarrativeBlock[] = [];
  const tags = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(tags)) {
    const value = cleanSicoddText(match[2] ?? "").slice(0, 1000);
    if (!value) continue;
    const tag = (match[1] ?? "").toLowerCase();
    blocks.push({
      kind: tag.startsWith("h") ? "heading" : tag === "li" ? "item" : "paragraph",
      value
    });
  }
  return blocks;
}

function narrativeSpecifications(blocks: NarrativeBlock[]) {
  const entries: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  let section = "CARACTERÍSTICA";
  let sequence = 0;

  const append = (labelValue: string, detailValue: string) => {
    const label = cleanSicoddText(labelValue).replace(/\s*:\s*$/u, "").slice(0, 180);
    const value = cleanSicoddText(detailValue).slice(0, 1000);
    if (!label || !value || label.toLocaleUpperCase("es-MX") === value.toLocaleUpperCase("es-MX")) {
      return;
    }
    const key = `${label.toLocaleUpperCase("es-MX")}\u0000${value.toLocaleUpperCase("es-MX")}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ label, value });
  };

  for (const block of blocks) {
    if (block.kind === "heading") {
      section = block.value.replace(/\s+/g, " ").replace(/\s*:\s*$/u, "").slice(0, 120);
      sequence = 0;
      continue;
    }

    const inline = block.value.match(/^(.{2,180}?)\s*:\s*(.{1,1000})$/u);
    if (inline) {
      append(inline[1], inline[2]);
      continue;
    }

    if (
      block.kind === "paragraph" &&
      block.value.length <= 80 &&
      /^(?:CARACTER[IÍ]STICAS|ESPECIFICACIONES|INFORMACI[OÓ]N|INCLUYE|VENTAJAS)\b/iu.test(
        block.value
      )
    ) {
      section = block.value.replace(/\s*:\s*$/u, "").slice(0, 120);
      sequence = 0;
      continue;
    }

    sequence += 1;
    append(`${section} ${sequence}`, block.value);
  }

  return entries;
}

function extractProductContent(html: string) {
  const detailHtml = productDetailHtml(html);
  const blocks = extractNarrativeBlocks(detailHtml);
  const entries = [
    ...extractTableSpecifications(detailHtml),
    ...narrativeSpecifications(blocks)
  ];
  const specifications: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.label.toLocaleUpperCase("es-MX")}\u0000${entry.value.toLocaleUpperCase("es-MX")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    specifications.push(entry);
    if (specifications.length === 120) break;
  }

  const description = blocks
    .filter((block) => block.kind !== "heading")
    .map((block) => block.value)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ")
    .slice(0, 12_000);

  return {
    description: description || null,
    specifications
  };
}

function extractImageUrls(html: string, pageUrl: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const source = readAttribute(match[1] ?? "", "src");
    if (!source) continue;
    try {
      const resolved = new URL(decodeHtml(source), pageUrl);
      if (
        resolved.origin !== new URL(pageUrl).origin ||
        /\/(?:images|js|css)\//i.test(resolved.pathname) ||
        ignoredAsset.test(resolved.pathname)
      )
        continue;
      urls.add(resolved.toString());
    } catch {
      // Ignore malformed image paths from an older supplier template.
    }
  }
  return [...urls].slice(0, 16);
}

export function parseSicoddProductPage(
  html: string,
  pageUrl: string
): SicoddProductCandidate {
  const text = cleanSicoddText(html);
  const partNumber = findInlineValue(text, "NO PARTE");
  const upc =
    text.match(/(?:UPC|SKU)\s*:\s*([A-Z0-9][A-Z0-9._/-]{0,159})/i)?.[1] ??
    findInlineValue(text, "UPC") ??
    findInlineValue(text, "SKU");
  const warranty = text.match(/GARANT[IÍ]A\s*:\s*(\d{1,3})/i);
  const labeledDescription =
    findInlineValue(text, "DESCRIPCIÓN") ?? findInlineValue(text, "DESCRIPCION");
  const content = extractProductContent(html);
  const description = labeledDescription ?? content.description;
  const heading = firstTagText(html, ["h1", "h2", "h3"]);
  const name = [labeledDescription, heading].find(isValidSicoddProductName) ?? null;
  const specifications = content.specifications;

  return {
    brand: inferSicoddBrand(name, specifications),
    description: description?.slice(0, 12_000) ?? null,
    imageUrls: extractImageUrls(html, pageUrl),
    name: name?.slice(0, 500) ?? null,
    partNumber: partNumber?.slice(0, 160) ?? null,
    // A model family or shortened part number can be shared by many UPCs.
    sourceKey: upc?.slice(0, 160) ?? null,
    sourcePayload: {
      capturedAt: new Date().toISOString(),
      parserVersion: sicoddParserVersion,
      textPreview: text.slice(0, 5000)
    },
    specifications,
    upc: upc?.slice(0, 160) ?? null,
    warrantyYears: warranty ? Number.parseInt(warranty[1], 10) : null
  };
}
