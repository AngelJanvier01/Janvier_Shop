import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  preparePrivateProposalImage,
  ProposalAssetValidationError
} from "../../lib/proposals/assets/image";
import {
  auditMarkdownAssetReferences,
  publicAssetManifest
} from "../../lib/proposals/assets/manifest";
import { LocalPrivateAssetStorage } from "../../lib/proposals/assets/storage";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((target) => rm(target, { force: true, recursive: true }))
  );
});

async function pngFixture() {
  return sharp({
    create: {
      background: { alpha: 1, b: 23, g: 40, r: 52 },
      channels: 4,
      height: 24,
      width: 32
    }
  })
    .png()
    .toBuffer();
}

describe("private proposal assets", () => {
  it("decodifica, normaliza y hashea una imagen admitida", async () => {
    const bytes = await pngFixture();
    const first = await preparePrivateProposalImage({
      bytes,
      declaredMimeType: "image/png",
      originalFileName: "architecture.png"
    });
    const second = await preparePrivateProposalImage({
      bytes,
      declaredMimeType: "image/png",
      originalFileName: "architecture.png"
    });

    expect(first.mimeType).toBe("image/png");
    expect(first.width).toBe(32);
    expect(first.height).toBe(24);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.sha256).toBe(second.sha256);
    expect(first.sizeBytes).toBeGreaterThan(0);
  });

  it("rechaza extensiÃ³n, MIME y bytes que no coinciden", async () => {
    const bytes = await pngFixture();
    await expect(
      preparePrivateProposalImage({
        bytes,
        declaredMimeType: "image/jpeg",
        originalFileName: "architecture.jpg"
      })
    ).rejects.toBeInstanceOf(ProposalAssetValidationError);
    await expect(
      preparePrivateProposalImage({
        bytes: new Uint8Array([1, 2, 3, 4]),
        declaredMimeType: "image/png",
        originalFileName: "architecture.png"
      })
    ).rejects.toBeInstanceOf(ProposalAssetValidationError);
  });

  it("mantiene bytes privados fuera de la ruta de manifiesto y no filtra storageKey", () => {
    const publicItems = publicAssetManifest([
      {
        accessUrl: "/api/proposals/assets/asset-1",
        alias: "architecture",
        altText: "Diagrama de arquitectura",
        height: 480,
        isDecorative: false,
        isRequired: true,
        mimeType: "image/png",
        removed: false,
        sha256: "a".repeat(64),
        width: 640
      },
      {
        accessUrl: "/api/proposals/assets/asset-retired",
        alias: "retired",
        altText: "",
        height: 1,
        isDecorative: true,
        isRequired: false,
        mimeType: "image/png",
        removed: true,
        sha256: "b".repeat(64),
        width: 1
      }
    ]);
    const serialized = JSON.stringify(publicItems);

    expect(publicItems).toHaveLength(1);
    expect(serialized).toContain("/api/proposals/assets/asset-1");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("isRequired");
    expect(serialized).not.toContain("retired");
  });

  it("detecta referencias faltantes, no usadas y ALT informativo pendiente", () => {
    const result = parseJanvierMarkdown(
      [
        "# Activos",
        "",
        "## Contexto {#context type=CONTEXT}",
        "",
        "![ ](asset:architecture)",
        "![No disponible](asset:missing)"
      ].join("\n")
    );
    expect(result.status).toBe("VALID");
    const report = auditMarkdownAssetReferences(result.document, [
      {
        alias: "architecture",
        altText: "",
        blob: {
          height: 480,
          mimeType: "image/png",
          sha256: "a".repeat(64),
          sizeBytes: 24,
          storageKey: "blobs/abcd/1234567890abcdef",
          width: 640
        },
        id: "asset-architecture",
        isDecorative: false,
        isRequired: false,
        removedAt: null
      },
      {
        alias: "unused",
        altText: "Imagen no usada",
        blob: {
          height: 480,
          mimeType: "image/png",
          sha256: "b".repeat(64),
          sizeBytes: 24,
          storageKey: "blobs/abce/1234567890abcdef",
          width: 640
        },
        id: "asset-unused",
        isDecorative: false,
        isRequired: true,
        removedAt: null
      }
    ]);

    expect(report.missingAliases).toEqual([
      { alias: "missing", line: null, occurrences: 1 }
    ]);
    expect(report.unusedAliases).toEqual(["unused"]);
    expect(report.unresolvedAltAliases).toEqual(["architecture"]);
  });

  it("almacena, lee y elimina una clave validada sin permitir rutas arbitrarias", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "janvier-assets-"));
    temporaryPaths.push(root);
    const storage = new LocalPrivateAssetStorage(root);
    const key = "blobs/abcd/1234567890abcdef";
    await storage.put({ bytes: new Uint8Array([1, 2, 3]), storageKey: key });

    expect(await storage.exists(key)).toBe(true);
    const stream = await storage.open(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks)).toEqual(Buffer.from([1, 2, 3]));
    await expect(
      storage.put({ bytes: new Uint8Array([1]), storageKey: "../public/leak" })
    ).rejects.toThrow();
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });
});
