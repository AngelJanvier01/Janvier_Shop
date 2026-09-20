import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";

const extensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png"
};

function storageRoot() {
  return resolve(
    process.env.CUSTOMER_DOCUMENT_STORAGE_PATH?.trim() ||
      join(process.cwd(), "data", "customer-documents")
  );
}

function assertStoragePath(path: string) {
  const root = storageRoot();
  const resolved = resolve(path);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) {
    throw new Error("CUSTOMER_DOCUMENT_STORAGE_PATH_INVALID");
  }
  return resolved;
}

function safeFilename(value: string) {
  const basename = value
    .replace(/[\u0000-\u001f\\/]/gu, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 180);
  return basename || "constancia-fiscal";
}

/** A conservative filename for an HTTP header, never derived from a raw upload. */
export function customerDocumentDownloadFilename(value: string) {
  const filename = safeFilename(value)
    .replace(/[^a-zA-Z0-9._-]/gu, "-")
    .replace(/-+/gu, "-")
    .slice(0, 180);
  return /[a-zA-Z0-9]/u.test(filename) ? filename : "constancia-fiscal";
}

export function customerDocumentExtension(contentType: string) {
  return extensions[contentType] ?? null;
}

export function isValidCustomerDocumentContent(contentType: string, contents: Buffer) {
  if (contentType === "application/pdf") {
    return contents.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (contentType === "image/jpeg") {
    return (
      contents.length >= 3 &&
      contents[0] === 0xff &&
      contents[1] === 0xd8 &&
      contents[2] === 0xff
    );
  }
  if (contentType === "image/png") {
    return (
      contents.length >= 8 &&
      contents
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return false;
}

export function customerDocumentPath(storageKey: string) {
  if (!storageKey || extname(storageKey) === "") {
    throw new Error("CUSTOMER_DOCUMENT_STORAGE_KEY_INVALID");
  }
  return assertStoragePath(join(storageRoot(), storageKey));
}

export async function writeCustomerEnrollmentDocument(input: {
  accountId: string;
  contentType: string;
  contents: Buffer;
  filename: string;
}) {
  const extension = customerDocumentExtension(input.contentType);
  if (!extension) throw new Error("CUSTOMER_DOCUMENT_TYPE_INVALID");
  const storageKey = join(input.accountId, `${randomUUID()}.${extension}`);
  const target = customerDocumentPath(storageKey);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, input.contents, { flag: "wx", mode: 0o640 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
  return { filename: safeFilename(input.filename), storageKey };
}

export function readCustomerEnrollmentDocument(storageKey: string) {
  return readFile(customerDocumentPath(storageKey));
}

export async function removeCustomerEnrollmentDocument(storageKey: string) {
  await rm(customerDocumentPath(storageKey), { force: true });
}
