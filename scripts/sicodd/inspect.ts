import "dotenv/config";

import {
  cleanSicoddText,
  extractProductEntries,
  extractProductLinks,
  parseSicoddProductPage
} from "../../lib/sicodd/catalog-parser";
import { createSicoddClient } from "../../lib/sicodd/client";

function extractLinks(html: string) {
  return [...html.matchAll(/href="([^"]+)"/gi)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href && !href.startsWith("#")))
    .filter((href) => href.startsWith("/admin"))
    .sort();
}

function requestedPath() {
  const flagIndex = process.argv.indexOf("--path");
  const path = flagIndex >= 0 ? process.argv[flagIndex + 1] : "/admin";
  if (!path?.startsWith("/admin") || path.startsWith("//")) {
    throw new Error("Use an internal SICODD path beginning with /admin.");
  }
  return path;
}

function extractForms(html: string) {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((form) => {
    const attributes = form[1] ?? "";
    const action = attributes.match(/\baction=["']?([^"'\s>]+)/i)?.[1] ?? null;
    const method = attributes.match(/\bmethod=["']?([^"'\s>]+)/i)?.[1] ?? "get";
    const inputs = [...(form[2] ?? "").matchAll(/<(?:input|select|textarea)\b([^>]*)>/gi)]
      .map((input) => input[1]?.match(/\bname=["']?([^"'\s>]+)/i)?.[1])
      .filter((name): name is string => Boolean(name));
    return { action, inputs, method: method.toLowerCase() };
  });
}

function extractCatalogFilters(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .flatMap((anchor) => {
      const attributes = anchor[1] ?? "";
      const code = attributes.match(/\$\('#clave'\)\.val\('([^']+)'\)/i)?.[1];
      if (!code) return [];
      return [{ code, label: cleanSicoddText(anchor[2] ?? "").slice(0, 180) }];
    })
    .slice(0, 320);
}

function extractScriptSources(html: string) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((script) => script[1])
    .filter((source): source is string => Boolean(source));
}

function extractDetailLinkContexts(html: string) {
  const pattern = /\/admin\/producto\/ficha\/upc\/[^"'\\\s<]+/gi;
  const contexts: Array<{ href: string; text: string }> = [];
  for (const match of html.matchAll(pattern)) {
    if (contexts.some((entry) => entry.href === match[0])) continue;
    const index = match.index ?? 0;
    const rowStart = html.lastIndexOf("<tr", index);
    const rowEnd = html.indexOf("</tr>", index);
    const fragment =
      rowStart >= 0 && rowEnd > index
        ? html.slice(rowStart, rowEnd + "</tr>".length)
        : html.slice(Math.max(0, index - 900), index + 450);
    contexts.push({
      href: match[0],
      text: cleanSicoddText(fragment).slice(0, 1600)
    });
    if (contexts.length === 4) break;
  }
  return contexts;
}

function extractListingRows(html: string) {
  const rows: string[][] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanSicoddText(cell[1] ?? ""));
    if (cells.some((cell) => cell.includes("$"))) rows.push(cells);
    if (rows.length === 5) break;
  }
  return rows;
}

function extractTableHeaders(html: string) {
  const headers: string[][] = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? "").matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((cell) => cleanSicoddText(cell[1] ?? ""))
      .filter(Boolean);
    if (cells.length) headers.push(cells);
    if (headers.length === 10) break;
  }
  return headers;
}

function extractFirstProductHtmlFragment(html: string) {
  const match = html.match(/\/admin\/producto\/ficha\/upc\/[^"'\s<]+/i);
  if (!match || match.index === undefined) return null;
  const rowStart = html.lastIndexOf("<tr", match.index);
  if (rowStart < 0) return null;
  const tags = /<\/?tr\b[^>]*>/gi;
  tags.lastIndex = rowStart;
  let depth = 0;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(rowStart, tag.index + tag[0].length);
  }
  return null;
}

const client = createSicoddClient();
await client.signIn();
const page = await client.getHtml(requestedPath());
const parsedProduct = page.url.includes("/admin/producto/ficha/")
  ? parseSicoddProductPage(page.html, page.url)
  : null;

console.log(
  JSON.stringify(
    {
      pageUrl: page.url,
      links: [...new Set(extractLinks(page.html))],
      forms: extractForms(page.html),
      catalogFilters: extractCatalogFilters(page.html),
      detectedProductLinks: extractProductLinks(page.html, page.url).slice(0, 12),
      detectedCommercialProducts: extractProductEntries(page.html, page.url).slice(0, 5),
      detailLinkContexts: extractDetailLinkContexts(page.html),
      listingRows: extractListingRows(page.html),
      tableHeaders: extractTableHeaders(page.html),
      firstProductHtmlFragment: extractFirstProductHtmlFragment(page.html),
      parsedProduct: parsedProduct
        ? {
            description: parsedProduct.description,
            imageUrls: parsedProduct.imageUrls,
            name: parsedProduct.name,
            partNumber: parsedProduct.partNumber,
            specifications: parsedProduct.specifications,
            upc: parsedProduct.upc,
            warrantyYears: parsedProduct.warrantyYears
          }
        : null,
      scriptSources: extractScriptSources(page.html),
      textPreview: cleanSicoddText(page.html).slice(0, 1600)
    },
    null,
    2
  )
);
