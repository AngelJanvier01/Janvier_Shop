import { describe, expect, it } from "vitest";

import { validateMarkdownUploadMetadata } from "../../lib/proposals/markdown";

describe("validateMarkdownUploadMetadata", () => {
  it.each([
    ["propuesta.md", "text/markdown"],
    ["propuesta.markdown", "text/x-markdown"],
    ["PROPUESTA.MD", "text/plain; charset=utf-8"]
  ])("acepta %s con MIME permitido", (fileName, mimeType) => {
    expect(
      validateMarkdownUploadMetadata({ fileName, mimeType, size: 120 })
    ).toMatchObject({
      ok: true
    });
  });

  it.each([
    ["propuesta.md.exe", "text/markdown", "INVALID_MARKDOWN_EXTENSION"],
    ["propuesta", "text/markdown", "INVALID_MARKDOWN_EXTENSION"],
    ["../propuesta.md", "text/markdown", "INVALID_MARKDOWN_FILE_NAME"],
    ["propuesta.md", "image/png", "INVALID_MARKDOWN_MIME"],
    ["propuesta.md", "text/markdown", "INVALID_MARKDOWN_SIZE"]
  ])("rechaza metadata no confiable: %s", (fileName, mimeType, expectedCode) => {
    const result = validateMarkdownUploadMetadata({
      fileName,
      mimeType,
      size: expectedCode === "INVALID_MARKDOWN_SIZE" ? 1024 * 1024 + 1 : 120
    });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
    }
  });
});
