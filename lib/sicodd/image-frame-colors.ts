import sharp from "sharp";

import {
  fallbackImageFrameColor,
  imageFrameColorFromRgba
} from "@/lib/commerce/image-frame-color";

const defaultSicoddBaseUrl = "https://janvier01.sicodd.com.mx";
const maximumImageBytes = 8 * 1024 * 1024;
const sampleSize = 64;

function trustedSicoddImageUrl(value: string) {
  try {
    const imageUrl = new URL(value);
    const sicoddUrl = new URL(process.env.SICODD_BASE_URL ?? defaultSicoddBaseUrl);
    const isTrustedOrigin =
      imageUrl.protocol === sicoddUrl.protocol &&
      imageUrl.hostname === sicoddUrl.hostname &&
      imageUrl.port === sicoddUrl.port;
    return isTrustedOrigin ? imageUrl : null;
  } catch {
    return null;
  }
}

export async function getSicoddImageFrameColor(imageUrl: string) {
  const trustedUrl = trustedSicoddImageUrl(imageUrl);
  if (!trustedUrl) return fallbackImageFrameColor;

  try {
    const response = await fetch(trustedUrl, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(10_000)
    });
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    const contentType = response.headers.get("content-type") ?? "";
    if (
      !response.ok ||
      !contentType.toLowerCase().startsWith("image/") ||
      (Number.isFinite(contentLength) && contentLength > maximumImageBytes)
    ) {
      return fallbackImageFrameColor;
    }

    const source = Buffer.from(await response.arrayBuffer());
    if (source.byteLength > maximumImageBytes) return fallbackImageFrameColor;

    const { data, info } = await sharp(source, { limitInputPixels: 16_000_000 })
      .resize(sampleSize, sampleSize, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return imageFrameColorFromRgba(data, info.width, info.height);
  } catch {
    return fallbackImageFrameColor;
  }
}

export async function getSicoddImageFrameColors(imageUrls: string[]) {
  return Promise.all(
    imageUrls.slice(0, 16).map((imageUrl) => getSicoddImageFrameColor(imageUrl))
  );
}
