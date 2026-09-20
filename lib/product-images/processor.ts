import { createHash } from "node:crypto";

import sharp, { type Sharp } from "sharp";

import { productImageConfiguration } from "./config";
import { inspectProductImageQuality } from "./quality";
import { productImageStorageKey, writeProductImageVariant } from "./storage";

const maximumRedirects = 3;
const normalizedCanvasSize = 1200;
const contentMarginRatio = 0.06;
const visibleAlphaThreshold = 8;
const backgroundAnalysisMaximumDimension = 1600;
const solidBackgroundTolerance = 24;
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function isPngImage(contents: Uint8Array) {
  return (
    contents.byteLength >= pngSignature.length &&
    pngSignature.every((byte, index) => contents[index] === byte)
  );
}

function assertSourceUrl(value: string) {
  const url = new URL(value);
  const { sourceHosts } = productImageConfiguration();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !sourceHosts.has(url.hostname.toLowerCase())
  ) {
    throw new Error("SOURCE_URL_NOT_ALLOWED");
  }
  return url;
}

async function responseBytes(response: Response, maximumBytes: number) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maximumBytes) throw new Error("SOURCE_IMAGE_TOO_LARGE");
  if (!response.body) throw new Error("SOURCE_IMAGE_EMPTY");

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error("SOURCE_IMAGE_TOO_LARGE");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export async function fetchProductImage(sourceUrl: string) {
  let url = assertSourceUrl(sourceUrl);
  for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
    const response = await fetch(url, {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000)
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === maximumRedirects) {
        throw new Error("SOURCE_REDIRECT_INVALID");
      }
      url = assertSourceUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0];
    if (!contentType?.startsWith("image/"))
      throw new Error("SOURCE_CONTENT_TYPE_INVALID");
    return {
      bytes: await responseBytes(
        response,
        productImageConfiguration().maximumSourceBytes
      ),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  }
  throw new Error("SOURCE_REDIRECT_INVALID");
}

async function removeBackground(source: Buffer) {
  const endpoint = new URL(
    "/v1/remove-background",
    productImageConfiguration().processorUrl
  );
  const response = await fetch(endpoint, {
    body: new Uint8Array(source),
    headers: { "content-type": "application/octet-stream" },
    method: "POST",
    signal: AbortSignal.timeout(180_000)
  });
  if (!response.ok) throw new Error(`PROCESSOR_HTTP_${response.status}`);
  const png = await responseBytes(
    response,
    productImageConfiguration().maximumSourceBytes
  );
  if (!png.length) throw new Error("PROCESSOR_EMPTY_RESPONSE");
  return {
    modelName: response.headers.get("x-model-name") ?? "unknown",
    modelRevision: response.headers.get("x-model-revision") ?? "unknown",
    png
  };
}

/**
 * SICODD can return WebP or PNG files with a valid alpha channel behind a
 * misleading `.jpg` URL. Re-segmenting an already clean cutout replaces its
 * precise edge with a lower-resolution ML mask, so retain trustworthy alpha
 * from any Sharp-supported source format.
 */
export async function sourceHasMeaningfulTransparency(source: Buffer) {
  const image = sharp(source, {
    failOn: "error",
    limitInputPixels: 80_000_000
  });
  const [metadata, statistics] = await Promise.all([image.metadata(), image.stats()]);
  const alpha = statistics.channels[3];
  return Boolean(
    metadata.hasAlpha &&
    alpha &&
    !statistics.isOpaque &&
    alpha.min < 250 &&
    alpha.max > 8 &&
    alpha.mean > 1
  );
}

async function visibleAlphaBounds(image: Sharp) {
  const { data, info } = await image
    .clone()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    const rowStart = y * info.width;
    for (let x = 0; x < info.width; x += 1) {
      if (data[rowStart + x] <= visibleAlphaThreshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return right >= left && bottom >= top
    ? { height: bottom - top + 1, left, top, width: right - left + 1 }
    : null;
}

/**
 * Some supplier cutouts encode the transparent pixels with opaque white RGB
 * values. When there is no usable alpha edge, infer a solid background from
 * the outside border and crop only if that border is convincingly uniform.
 */
async function solidBackgroundContentBounds(
  image: Sharp,
  sourceHeight: number,
  sourceWidth: number
) {
  const { data, info } = await image
    .clone()
    .removeAlpha()
    .resize({
      fit: "inside",
      height: backgroundAnalysisMaximumDimension,
      withoutEnlargement: true,
      width: backgroundAnalysisMaximumDimension
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height || info.channels < 3) return null;

  const buckets = new Map<string, { b: number; count: number; g: number; r: number }>();
  const borderLength = info.width * 2 + Math.max(0, info.height - 2) * 2;
  const recordBorderPixel = (x: number, y: number) => {
    const offset = (y * info.width + x) * info.channels;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    const key = `${Math.floor(r / 16)}:${Math.floor(g / 16)}:${Math.floor(b / 16)}`;
    const current = buckets.get(key) ?? { b: 0, count: 0, g: 0, r: 0 };
    current.b += b;
    current.count += 1;
    current.g += g;
    current.r += r;
    buckets.set(key, current);
  };

  for (let x = 0; x < info.width; x += 1) {
    recordBorderPixel(x, 0);
    if (info.height > 1) recordBorderPixel(x, info.height - 1);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    recordBorderPixel(0, y);
    if (info.width > 1) recordBorderPixel(info.width - 1, y);
  }

  const background = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!background || background.count / borderLength < 0.7) return null;
  const backgroundColor = {
    b: background.b / background.count,
    g: background.g / background.count,
    r: background.r / background.count
  };
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const difference = Math.max(
        Math.abs((data[offset] ?? 0) - backgroundColor.r),
        Math.abs((data[offset + 1] ?? 0) - backgroundColor.g),
        Math.abs((data[offset + 2] ?? 0) - backgroundColor.b)
      );
      if (difference <= solidBackgroundTolerance) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  const scaleX = sourceWidth / info.width;
  const scaleY = sourceHeight / info.height;
  const extra = Math.max(2, Math.round(Math.max(right - left, bottom - top) * 0.08));
  const analyzedLeft = Math.max(0, left - extra);
  const analyzedTop = Math.max(0, top - extra);
  const analyzedRight = Math.min(info.width - 1, right + extra);
  const analyzedBottom = Math.min(info.height - 1, bottom + extra);

  return {
    height:
      Math.min(sourceHeight, Math.ceil((analyzedBottom + 1) * scaleY)) -
      Math.floor(analyzedTop * scaleY),
    left: Math.floor(analyzedLeft * scaleX),
    top: Math.floor(analyzedTop * scaleY),
    width:
      Math.min(sourceWidth, Math.ceil((analyzedRight + 1) * scaleX)) -
      Math.floor(analyzedLeft * scaleX)
  };
}

/**
 * Supplier images and removal models frequently preserve a large transparent
 * canvas around a small product. Trim that empty canvas, then restore a
 * proportional breathing room on a consistent square surface. The catalog
 * can consequently present the product at a useful size without per-product
 * CSS zoom or distortion.
 */
export async function normalizeProductImageCanvas(source: Buffer) {
  const sourceImage = sharp(source, {
    failOn: "error",
    limitInputPixels: 80_000_000
  }).ensureAlpha();
  const sourceMetadata = await sourceImage.metadata();
  const canTrim = (sourceMetadata.width ?? 0) >= 3 && (sourceMetadata.height ?? 0) >= 3;
  const sourceWidth = sourceMetadata.width ?? 0;
  const sourceHeight = sourceMetadata.height ?? 0;
  const alphaBounds = canTrim ? await visibleAlphaBounds(sourceImage) : null;
  const alphaCropsCanvas = Boolean(
    alphaBounds &&
    (alphaBounds.width < sourceWidth * 0.96 || alphaBounds.height < sourceHeight * 0.96)
  );
  const contentBounds = alphaCropsCanvas
    ? alphaBounds
    : canTrim
      ? await solidBackgroundContentBounds(sourceImage, sourceHeight, sourceWidth)
      : null;
  const trimLeft = contentBounds?.left ?? 0;
  const trimTop = contentBounds?.top ?? 0;
  const trimWidth = contentBounds?.width ?? sourceWidth;
  const trimHeight = contentBounds?.height ?? sourceHeight;
  const cropIsValid =
    trimLeft >= 0 &&
    trimTop >= 0 &&
    trimWidth > 0 &&
    trimHeight > 0 &&
    trimLeft + trimWidth <= sourceWidth &&
    trimTop + trimHeight <= sourceHeight;
  const { data: trimmed, info } = await (cropIsValid
    ? sourceImage
        .clone()
        .extract({ height: trimHeight, left: trimLeft, top: trimTop, width: trimWidth })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true })
    : sourceImage.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true }));
  const contentSize = Math.max(info.width, info.height);
  const margin = Math.max(8, Math.round(contentSize * contentMarginRatio));
  const padded = await sharp(trimmed, {
    failOn: "error",
    limitInputPixels: 80_000_000
  })
    .extend({
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      bottom: margin,
      left: margin,
      right: margin,
      top: margin
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return sharp(padded, {
    failOn: "error",
    limitInputPixels: 80_000_000
  })
    .resize({
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
      height: normalizedCanvasSize,
      width: normalizedCanvasSize
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export type FetchedProductImage = Awaited<ReturnType<typeof fetchProductImage>>;

export async function processFetchedProductImage(
  input: {
    id: string;
    processingVersion: number;
    sourceUrl: string;
  },
  source: FetchedProductImage
) {
  const sourceHash = createHash("sha256").update(source.bytes).digest("hex");
  const sourceHasTransparency = await sourceHasMeaningfulTransparency(source.bytes);
  const processed = sourceHasTransparency
    ? {
        modelName: "SOURCE_IMAGE_WITH_ALPHA",
        modelRevision: "2",
        png: source.bytes
      }
    : await removeBackground(source.bytes);
  const normalizedPng = await normalizeProductImageCanvas(processed.png);
  const image = sharp(normalizedPng, {
    failOn: "error",
    limitInputPixels: 80_000_000
  });
  const metadata = await image.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.format !== "png" ||
    !metadata.hasAlpha
  ) {
    throw new Error("PROCESSOR_OUTPUT_INVALID");
  }

  const [png, webp, avif] = await Promise.all([
    Promise.resolve(normalizedPng),
    sharp(normalizedPng).webp({ alphaQuality: 100, quality: 88 }).toBuffer(),
    sharp(normalizedPng).avif({ effort: 6, quality: 72 }).toBuffer()
  ]);
  const storageKey = productImageStorageKey(
    input.id,
    sourceHash,
    input.processingVersion
  );
  await Promise.all([
    writeProductImageVariant(storageKey, "png", png),
    writeProductImageVariant(storageKey, "webp", webp),
    writeProductImageVariant(storageKey, "avif", avif)
  ]);
  const quality = await inspectProductImageQuality(png);

  return {
    // Images that pass the transparency and content checks can safely replace
    // the supplier URL. Ambiguous outputs remain in READY for human review.
    autoApproved: quality.autoApproved,
    autoApprovalMessage: quality.message,
    height: metadata.height,
    modelName: processed.modelName,
    modelRevision: processed.modelRevision,
    pngBytes: png.byteLength,
    sourceEtag: source.etag,
    sourceHash,
    sourceModifiedAt: source.lastModified,
    storageKey,
    width: metadata.width
  };
}

export async function processProductImage(input: {
  id: string;
  processingVersion: number;
  sourceUrl: string;
}) {
  return processFetchedProductImage(input, await fetchProductImage(input.sourceUrl));
}
