import sharp from "sharp";

export type ProductImageQuality = {
  autoApproved: boolean;
  message: string;
};

const minimumDimension = 72;
const maximumPixels = 80_000_000;

/**
 * A local derivative is only published automatically when it is a real PNG
 * with a meaningful transparent canvas. This deliberately prefers the review
 * queue over publishing a failed background-removal result.
 */
export async function inspectProductImageQuality(
  png: Buffer
): Promise<ProductImageQuality> {
  const image = sharp(png, { failOn: "error", limitInputPixels: maximumPixels });
  const [metadata, statistics] = await Promise.all([image.metadata(), image.stats()]);
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const alpha = statistics.channels[3];

  if (
    metadata.format !== "png" ||
    !metadata.hasAlpha ||
    !alpha ||
    width < minimumDimension ||
    height < minimumDimension
  ) {
    return {
      autoApproved: false,
      message: "El resultado no cumple el formato o tamaño mínimo para publicación automática."
    };
  }

  // `hasAlpha` only means that an alpha channel exists. A fully opaque image
  // still carries one, so also require transparent pixels and visible content.
  if (statistics.isOpaque || alpha.min > 250 || alpha.max < 8 || alpha.mean < 1) {
    return {
      autoApproved: false,
      message:
        "El recorte no tiene suficiente transparencia verificable; requiere revisión visual."
    };
  }

  return {
    autoApproved: true,
    message: "PNG con transparencia y contenido verificables."
  };
}
