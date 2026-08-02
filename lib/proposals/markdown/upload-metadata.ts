import { markdownLimits } from "./parser";

const acceptedMimeTypes = new Set([
  "text/markdown",
  "text/x-markdown",
  // Browsers commonly report a .md selection as text/plain.
  "text/plain"
]);

export type MarkdownUploadMetadata = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type MarkdownUploadMetadataIssue = {
  code:
    | "INVALID_MARKDOWN_FILE_NAME"
    | "INVALID_MARKDOWN_EXTENSION"
    | "INVALID_MARKDOWN_MIME"
    | "INVALID_MARKDOWN_SIZE";
  message: string;
};

export type MarkdownUploadMetadataValidation =
  | { issues: []; ok: true; value: MarkdownUploadMetadata }
  | { issues: MarkdownUploadMetadataIssue[]; ok: false };

/**
 * HTTP/upload boundary validation for Hito B. The parser deliberately accepts
 * bytes only; it does not infer trust from a browser-supplied filename or MIME.
 */
export function validateMarkdownUploadMetadata(
  input: MarkdownUploadMetadata
): MarkdownUploadMetadataValidation {
  const issues: MarkdownUploadMetadataIssue[] = [];
  const fileName = input.fileName.trim();
  const mimeType = input.mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  if (
    !fileName ||
    fileName.length > 255 ||
    /[\\/\u0000-\u001f]/u.test(fileName) ||
    fileName === "." ||
    fileName === ".."
  ) {
    issues.push({
      code: "INVALID_MARKDOWN_FILE_NAME",
      message: "El nombre del archivo Markdown no es seguro."
    });
  } else if (!/\.(?:md|markdown)$/iu.test(fileName)) {
    issues.push({
      code: "INVALID_MARKDOWN_EXTENSION",
      message: "Sólo se aceptan archivos .md o .markdown."
    });
  }

  if (!acceptedMimeTypes.has(mimeType)) {
    issues.push({
      code: "INVALID_MARKDOWN_MIME",
      message: "El tipo MIME no corresponde a un archivo Markdown permitido."
    });
  }

  if (
    !Number.isSafeInteger(input.size) ||
    input.size < 1 ||
    input.size > markdownLimits.maxBytes
  ) {
    issues.push({
      code: "INVALID_MARKDOWN_SIZE",
      message: "El tamaño declarado del archivo Markdown no es válido."
    });
  }

  return issues.length
    ? { issues, ok: false }
    : { issues: [], ok: true, value: { fileName, mimeType, size: input.size } };
}
