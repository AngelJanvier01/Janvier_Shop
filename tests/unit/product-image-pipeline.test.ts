import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { getProductGallery } from "@/lib/commerce/catalog";
import {
  productImageQueueRows,
  productImageSourceHash
} from "@/lib/product-images/queue";
import {
  fetchProductImage,
  isPngImage,
  processProductImage,
  sourceHasMeaningfulTransparency
} from "@/lib/product-images/processor";
import { inspectProductImageQuality } from "@/lib/product-images/quality";
import {
  productImageStorageKey,
  productImageVariantPath,
  readProductImageVariant,
  writeProductImageVariant
} from "@/lib/product-images/storage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("product image derivatives", () => {
  it("keeps source ordering and deduplicates queue rows", () => {
    const rows = productImageQueueRows("product-1", "https://img.test/main.jpg", [
      "https://img.test/main.jpg",
      "https://img.test/detail.jpg"
    ]);

    expect(rows).toEqual([
      {
        productId: "product-1",
        sourcePosition: 0,
        sourceUrl: "https://img.test/main.jpg",
        sourceUrlHash: productImageSourceHash("https://img.test/main.jpg")
      },
      {
        productId: "product-1",
        sourcePosition: 1,
        sourceUrl: "https://img.test/detail.jpg",
        sourceUrlHash: productImageSourceHash("https://img.test/detail.jpg")
      }
    ]);
  });

  it("uses only approved replacements that match an original source", () => {
    const gallery = getProductGallery(
      "https://img.test/main.jpg",
      ["https://img.test/detail.jpg"],
      [
        {
          id: "asset-main",
          processingVersion: 4,
          sourceUrl: "https://img.test/main.jpg",
          status: "APPROVED"
        },
        {
          id: "stale-asset",
          processingVersion: 1,
          sourceUrl: "https://img.test/removed.jpg",
          status: "APPROVED"
        }
      ]
    );

    expect(gallery).toEqual(["/api/product-images/asset-main/webp?v=4"]);
  });

  it("keeps the last approved local version visible while a replacement is processing", () => {
    const gallery = getProductGallery(
      "https://img.test/main.jpg",
      [],
      [
        {
          id: "asset-main",
          processingVersion: 5,
          sourceUrl: "https://img.test/main.jpg",
          status: "PROCESSING"
        }
      ]
    );

    expect(gallery).toEqual(["/api/product-images/asset-main/webp?v=4"]);
  });

  it("rejects non-HTTPS and non-allowlisted source URLs before fetching", async () => {
    vi.stubEnv("PRODUCT_IMAGE_SOURCE_HOSTS", "images.example.test");

    await expect(
      fetchProductImage("http://images.example.test/product.jpg")
    ).rejects.toThrow("SOURCE_URL_NOT_ALLOWED");
    await expect(
      fetchProductImage("https://other.example.test/product.jpg")
    ).rejects.toThrow("SOURCE_URL_NOT_ALLOWED");
    await expect(
      fetchProductImage("https://user:secret@images.example.test/product.jpg")
    ).rejects.toThrow("SOURCE_URL_NOT_ALLOWED");
  });

  it("recognizes PNG bytes instead of trusting the URL extension", () => {
    expect(isPngImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe(
      true
    );
    expect(isPngImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
  });

  it("recognizes a clean alpha channel in WebP sources as reusable", async () => {
    const webpWithAlpha = await sharp({
      create: {
        background: { alpha: 0, b: 40, g: 20, r: 10 },
        channels: 4,
        height: 32,
        width: 32
      }
    })
      .composite([
        {
          input: Buffer.alloc(8 * 8 * 4, 255),
          raw: { channels: 4, height: 8, width: 8 },
          top: 12,
          left: 12
        }
      ])
      .webp()
      .toBuffer();
    const opaqueWebp = await sharp({
      create: { background: "white", channels: 3, height: 32, width: 32 }
    })
      .webp()
      .toBuffer();

    await expect(sourceHasMeaningfulTransparency(webpWithAlpha)).resolves.toBe(true);
    await expect(sourceHasMeaningfulTransparency(opaqueWebp)).resolves.toBe(false);
  });

  it("auto-approves only a usable transparent PNG derivative", async () => {
    const transparentProduct = await sharp({
      create: {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        channels: 4,
        height: 120,
        width: 120
      }
    })
      .composite([
        {
          input: await sharp({
            create: {
              background: { alpha: 1, b: 30, g: 30, r: 30 },
              channels: 4,
              height: 72,
              width: 72
            }
          })
            .png()
            .toBuffer(),
          left: 24,
          top: 24
        }
      ])
      .png()
      .toBuffer();
    const opaqueProduct = await sharp({
      create: {
        background: { b: 255, g: 255, r: 255 },
        channels: 3,
        height: 120,
        width: 120
      }
    })
      .png()
      .toBuffer();

    await expect(inspectProductImageQuality(transparentProduct)).resolves.toMatchObject({
      autoApproved: true
    });
    await expect(inspectProductImageQuality(opaqueProduct)).resolves.toMatchObject({
      autoApproved: false
    });
  });

  it("sends an opaque PNG through segmentation and requires review", async () => {
    const root = await mkdtemp(join(tmpdir(), "janvier-opaque-png-"));
    const sourcePng = await sharp({
      create: {
        background: { b: 0, g: 0, r: 255 },
        channels: 3,
        height: 2,
        width: 2
      }
    })
      .png()
      .toBuffer();
    const processedPng = await sharp(sourcePng).ensureAlpha(0).png().toBuffer();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array(sourcePng), {
          headers: { "content-type": "image/png" }
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array(processedPng), {
          headers: {
            "content-type": "image/png",
            "x-model-name": "test-segmenter",
            "x-model-revision": "test-revision"
          }
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PRODUCT_IMAGE_SOURCE_HOSTS", "images.example.test");
    vi.stubEnv("PRODUCT_IMAGE_STORAGE_PATH", root);

    try {
      const result = await processProductImage({
        id: "asset-png",
        processingVersion: 1,
        sourceUrl: "https://images.example.test/misleading-extension.jpg"
      });

      expect(result.autoApproved).toBe(false);
      expect(result.modelName).toBe("test-segmenter");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const master = await readProductImageVariant(result.storageKey, "png");
      await expect(sharp(master).metadata()).resolves.toMatchObject({ hasAlpha: true });
      await expect(
        readProductImageVariant(result.storageKey, "webp")
      ).resolves.not.toHaveLength(0);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("preserves an already transparent PNG but still leaves it for review", async () => {
    const root = await mkdtemp(join(tmpdir(), "janvier-transparent-png-"));
    const sourcePng = await sharp({
      create: {
        background: { alpha: 0, b: 0, g: 0, r: 255 },
        channels: 4,
        height: 2,
        width: 2
      }
    })
      .composite([
        {
          input: Buffer.from([255, 255, 255, 255]),
          left: 1,
          raw: { channels: 4, height: 1, width: 1 },
          top: 1
        }
      ])
      .png()
      .toBuffer();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(sourcePng), {
        headers: { "content-type": "image/png" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PRODUCT_IMAGE_SOURCE_HOSTS", "images.example.test");
    vi.stubEnv("PRODUCT_IMAGE_STORAGE_PATH", root);

    try {
      const result = await processProductImage({
        id: "asset-transparent-png",
        processingVersion: 1,
        sourceUrl: "https://images.example.test/product.png"
      });

      expect(result.autoApproved).toBe(false);
      expect(result.modelName).toBe("SOURCE_IMAGE_WITH_ALPHA");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("writes atomically inside the configured storage root", async () => {
    const root = await mkdtemp(join(tmpdir(), "janvier-product-images-"));
    vi.stubEnv("PRODUCT_IMAGE_STORAGE_PATH", root);
    const key = productImageStorageKey("asset-1", "a".repeat(64), 2);

    try {
      await writeProductImageVariant(key, "webp", Buffer.from("image-data"));
      await expect(readProductImageVariant(key, "webp")).resolves.toEqual(
        Buffer.from("image-data")
      );
      expect(productImageVariantPath(key, "webp")).toContain(root);
      expect(() => productImageVariantPath("../escape", "webp")).toThrow(
        "PRODUCT_IMAGE_STORAGE_PATH_INVALID"
      );
      expect(() => productImageVariantPath(key, "svg")).toThrow(
        "PRODUCT_IMAGE_VARIANT_INVALID"
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("migrates the durable queue with its claim and review indexes", async () => {
    const sql = await readFile(
      join(
        process.cwd(),
        "prisma/migrations/20260917030000_product_image_derivatives/migration.sql"
      ),
      "utf8"
    );

    expect(sql).toContain('CREATE TYPE "ProductImageProcessingStatus"');
    expect(sql).toContain('CREATE TABLE "ProductImageDerivative"');
    expect(sql).toContain('"ProductImageDerivative_status_nextAttemptAt_createdAt_idx"');
    expect(sql).toContain('CONSTRAINT "ProductImageDerivative_productId_fkey"');
  });
});
