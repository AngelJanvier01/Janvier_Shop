type AnchorLink = {
  href: string;
  label: string;
};

export type SicoddProductCandidate = {
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

const ignoredAsset = /(?:logo|icon|sprite|loading|blank|facebook|twitter|instagram)/i;

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

export function extractInternalAdminLinks(html: string, pageUrl: string) {
  const links = new Map<string, AnchorLink>();
  for (const anchor of allAnchors(html, pageUrl)) {
    if (!links.has(anchor.href)) links.set(anchor.href, anchor);
  }
  return [...links.values()].slice(0, 120);
}

export function extractProductLinks(html: string, pageUrl: string) {
  const currentUrl = new URL(pageUrl).toString();
  const productHint = /(?:producto|product|ficha|detalle|articulo|art[ií]culo|part[e]?|modelo|sku|upc)/i;
  const exclusions = /(?:diccionario|configuracion|usuarios|cotizaciones|proveedor|logout|salir|carrito)/i;
  const links = new Map<string, string>();

  for (const anchor of allAnchors(html, pageUrl)) {
    if (anchor.href === currentUrl || exclusions.test(`${anchor.href} ${anchor.label}`)) continue;
    if (!productHint.test(`${anchor.href} ${anchor.label}`)) continue;
    if (!links.has(anchor.href)) links.set(anchor.href, anchor.label);
  }
  return [...links.entries()].map(([href, label]) => ({ href, label }));
}

function firstTagText(html: string, selectors: string[]) {
  for (const selector of selectors) {
    const match = html.match(new RegExp(`<${selector}\\b[^>]*>([\\s\\S]*?)<\\/${selector}>`, "i"));
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

function extractSpecifications(html: string) {
  const entries: Array<{ label: string; value: string }> = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanSicoddText(cell[1] ?? ""))
      .filter(Boolean);
    if (cells.length < 2) continue;
    const [label, ...values] = cells;
    const value = values.join(" · ");
    if (label.length <= 180 && value.length <= 1000) entries.push({ label, value });
  }
  return entries.slice(0, 80);
}

function extractImageUrls(html: string, pageUrl: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const source = readAttribute(match[1] ?? "", "src");
    if (!source) continue;
    try {
      const resolved = new URL(decodeHtml(source), pageUrl);
      if (resolved.origin !== new URL(pageUrl).origin || ignoredAsset.test(resolved.pathname)) continue;
      urls.add(resolved.toString());
    } catch {
      // Ignore malformed image paths from an older supplier template.
    }
  }
  return [...urls].slice(0, 16);
}

export function parseSicoddProductPage(html: string, pageUrl: string): SicoddProductCandidate {
  const text = cleanSicoddText(html);
  const partNumber = findInlineValue(text, "NO PARTE");
  const upc = findInlineValue(text, "UPC") ?? findInlineValue(text, "SKU");
  const warranty = text.match(/GARANT[IÍ]A\s*:\s*(\d{1,3})/i);
  const description = findInlineValue(text, "DESCRIPCI[OÓ]N");
  const heading = firstTagText(html, ["h1", "h2", "h3", "title"]);
  const name = description ?? heading;

  return {
    description: description?.slice(0, 12_000) ?? null,
    imageUrls: extractImageUrls(html, pageUrl),
    name: name?.slice(0, 500) ?? null,
    partNumber: partNumber?.slice(0, 160) ?? null,
    sourceKey: partNumber?.slice(0, 160) ?? upc?.slice(0, 160) ?? null,
    sourcePayload: {
      capturedAt: new Date().toISOString(),
      textPreview: text.slice(0, 5000)
    },
    specifications: extractSpecifications(html),
    upc: upc?.slice(0, 160) ?? null,
    warrantyYears: warranty ? Number.parseInt(warranty[1], 10) : null
  };
}
