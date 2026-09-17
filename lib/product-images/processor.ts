import { createHash } from "node:crypto";

import sharp from "sharp";

import { productImageConfiguration } from "./config";
import { productImageStorageKey, writeProductImageVariant } from "./storage";

const maximumRedirects = 3;
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

export async function processProductImage(input: {
  id: string;
  processingVersion: number;
  sourceUrl: string;
}) {
  const source = await fetchProductImage(input.sourceUrl);
  const sourceHash = createHash("sha256").update(source.bytes).digest("hex");
  const sourceIsPng = isPngImage(source.bytes);
  const processed = sourceIsPng
    ? {
        modelName: "SOURCE_PNG_PASSTHROUGH",
        modelRevision: "1",
        png: source.bytes
      }
    : await removeBackground(source.bytes);
  const image = sharp(processed.png, {
    failOn: "error",
    limitInputPixels: 80_000_000
  });
  const metadata = await image.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.format !== "png" ||
    (!sourceIsPng && !metadata.hasAlpha)
  ) {
    throw new Error("PROCESSOR_OUTPUT_INVALID");
  }

  const [png, webp, avif] = await Promise.all([
    sourceIsPng
      ? Promise.resolve(source.bytes)
      : sharp(processed.png).png({ compressionLevel: 9 }).toBuffer(),
    sharp(processed.png).webp({ alphaQuality: 100, quality: 88 }).toBuffer(),
    sharp(processed.png).avif({ effort: 6, quality: 72 }).toBuffer()
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

  return {
    autoApproved: sourceIsPng,
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
