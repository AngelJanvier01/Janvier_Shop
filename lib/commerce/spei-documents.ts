import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { database } from "@/lib/database";
import { getProposalAssetStorage } from "@/lib/proposals/assets/storage";

import { createSpeiQuotePdf, type SpeiQuoteDocument } from "./spei-quote-pdf";
import { sha256 } from "./payment-core";

export const speiProofMaxBytes = 10 * 1024 * 1024;

type StoredSpeiDocument = {
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  originalFileName: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

function documentKey(quoteId: string) {
  return `blobs/commerce/spei/${quoteId}/quote`;
}

function proofKey(quoteId: string) {
  return `blobs/commerce/spei/${quoteId}/proof-${randomUUID()}`;
}

function cleanFileName(value: string) {
  const cleaned = value
    .replace(/[\u0000-\u001f\\/]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 180);
  return cleaned || "comprobante";
}

function detectsPdf(bytes: Uint8Array) {
  return (
    bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
  );
}

function detectsPng(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function detectsJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function validateSpeiProof(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  originalFileName: string;
}): StoredSpeiDocument {
  const name = cleanFileName(input.originalFileName);
  const declared = input.declaredMimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!input.bytes.length || input.bytes.length > speiProofMaxBytes) {
    throw new Error("El comprobante debe pesar entre 1 byte y 10 MB.");
  }
  const detected = detectsPdf(input.bytes)
    ? "application/pdf"
    : detectsPng(input.bytes)
      ? "image/png"
      : detectsJpeg(input.bytes)
        ? "image/jpeg"
        : null;
  const extensionMatches =
    (detected === "application/pdf" && /\.pdf$/iu.test(name)) ||
    (detected === "image/png" && /\.png$/iu.test(name)) ||
    (detected === "image/jpeg" && /\.(?:jpg|jpeg)$/iu.test(name));
  if (!detected || detected !== declared || !extensionMatches) {
    throw new Error(
      "Sólo se aceptan PDF, PNG o JPG válidos; MIME, extensión y archivo deben coincidir."
    );
  }
  return {
    bytes: input.bytes,
    mimeType: detected,
    originalFileName: name,
    sizeBytes: input.bytes.byteLength
  };
}

export async function storeSpeiProof(input: {
  quoteId: string;
  document: StoredSpeiDocument;
}) {
  const storage = getProposalAssetStorage();
  const storageKey = proofKey(input.quoteId);
  await storage.put({ bytes: input.document.bytes, storageKey });
  return {
    ...input.document,
    sha256: sha256(input.document.bytes),
    storageKey
  };
}

export async function removeStoredSpeiDocument(storageKey: string) {
  await getProposalAssetStorage()
    .delete(storageKey)
    .catch(() => undefined);
}

function quoteDocumentFromRecord(quote: {
  bankAccountSnapshot: unknown;
  customerCompanyName: string;
  customerContactName: string;
  customerEmail: string;
  discountAmount: { toString(): string } | number;
  discountPercentage: { toString(): string } | number;
  expiresAt: Date;
  issuedAt: Date;
  items: Array<{
    brand: string | null;
    lineTotal: { toString(): string } | number;
    name: string | null;
    quantity: number;
    sku: string | null;
    unitPrice: { toString(): string } | number;
  }>;
  reference: string;
  sellerContact: string | null;
  sellerName: string;
  sellerTerms: string | null;
  subtotal: { toString(): string } | number;
  total: { toString(): string } | number;
  totalBeforeDiscount: { toString(): string } | number;
}): SpeiQuoteDocument {
  return {
    bankAccount: quote.bankAccountSnapshot as SpeiQuoteDocument["bankAccount"],
    customerCompanyName: quote.customerCompanyName,
    customerContactName: quote.customerContactName,
    customerEmail: quote.customerEmail,
    discountAmount: Number(quote.discountAmount),
    discountPercentage: Number(quote.discountPercentage),
    expiresAt: quote.expiresAt,
    issuedAt: quote.issuedAt,
    items: quote.items.map((item) => ({
      brand: item.brand,
      lineTotal: Number(item.lineTotal),
      name: item.name,
      quantity: item.quantity,
      sku: item.sku,
      unitPrice: Number(item.unitPrice)
    })),
    reference: quote.reference,
    sellerContact: quote.sellerContact,
    sellerName: quote.sellerName,
    sellerTerms: quote.sellerTerms,
    subtotal: Number(quote.subtotal),
    total: Number(quote.total),
    totalBeforeDiscount: Number(quote.totalBeforeDiscount)
  };
}

/** Explicit document issuance only. Existing PDFs are never silently regenerated. */
export async function issueSpeiQuotePdf(quoteId: string) {
  const quote = await database.commerceSpeiQuote.findUnique({
    include: { items: { orderBy: { createdAt: "asc" } } },
    where: { id: quoteId }
  });
  if (!quote) throw new Error("No fue posible encontrar la cotización SPEI.");
  if (quote.pdfStorageKey && quote.pdfSha256) {
    return { alreadyIssued: true, storageKey: quote.pdfStorageKey };
  }
  const logo = await readFile(
    join(process.cwd(), "public", "brand", "angel_janvier_logo_black_1600.png")
  ).catch(() => null);
  const pdf = await createSpeiQuotePdf(quoteDocumentFromRecord(quote), logo);
  const storageKey = documentKey(quote.id);
  try {
    await getProposalAssetStorage().put({ bytes: pdf, storageKey });
    const updated = await database.commerceSpeiQuote.updateMany({
      data: {
        pdfGeneratedAt: new Date(),
        pdfGenerationError: null,
        pdfSha256: sha256(pdf),
        pdfStorageKey: storageKey
      },
      where: { id: quote.id, pdfStorageKey: null }
    });
    if (!updated.count) {
      return { alreadyIssued: true, storageKey };
    }
    return { alreadyIssued: false, storageKey };
  } catch (error) {
    await database.commerceSpeiQuote.updateMany({
      data: { pdfGenerationError: "No fue posible emitir el documento definitivo." },
      where: { id: quote.id, pdfStorageKey: null }
    });
    throw error;
  }
}

export async function readSpeiStoredDocument(storageKey: string) {
  return getProposalAssetStorage().open(storageKey);
}
