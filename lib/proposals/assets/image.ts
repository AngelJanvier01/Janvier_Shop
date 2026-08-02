import { createHash } from "node:crypto";
import path from "node:path";

import sharp from "sharp";

import { getProposalAssetConfig, proposalAssetLimits } from "./config";

export const proposalAssetMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export type ProposalAssetMimeType = (typeof proposalAssetMimeTypes)[number];

const mimeByExtension: Record<string, ProposalAssetMimeType> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export class ProposalAssetValidationError extends Error {}

export function normalizeProposalAssetAlias(value: string) {
  return value.trim().toLowerCase();
}

export function assertProposalAssetAlias(value: string) {
  const alias = normalizeProposalAssetAlias(value);
  if (!/^[a-z][a-z0-9-]{0,79}$/u.test(alias)) {
    throw new ProposalAssetValidationError(
      "El alias debe usar minúsculas, números o guiones y comenzar con una letra."
    );
  }
  return alias;
}

function declaredMimeForFileName(fileName: string) {
  if (!fileName || fileName.length > 255 || /[\u0000-\u001f\\/]/u.test(fileName)) {
    throw new ProposalAssetValidationError(
      "El nombre original del archivo no es válido."
    );
  }
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = mimeByExtension[extension];
  if (!mimeType) {
    throw new ProposalAssetValidationError("Sólo se permiten imágenes PNG, JPEG o WebP.");
  }
  return mimeType;
}

function detectedMimeType(bytes: Uint8Array): ProposalAssetMimeType {
  if (
    bytes.length >= 24 &&
    bytes
      .subarray(0, 8)
      .every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
  ) {
    let offset = 8;
    let complete = false;
    while (offset + 12 <= bytes.length) {
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
      const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("ascii");
      offset += 12 + size;
      if (offset > bytes.length) {
        break;
      }
      if (type === "IEND") {
        complete = offset === bytes.length;
        break;
      }
    }
    if (!complete) {
      throw new ProposalAssetValidationError(
        "El contenedor PNG está truncado o contiene datos anexos."
      );
    }
    return "image/png";
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      throw new ProposalAssetValidationError(
        "El contenedor JPEG está truncado o contiene datos anexos."
      );
    }
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    const declaredLength = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(
      0,
      true
    );
    if (declaredLength + 8 !== bytes.length) {
      throw new ProposalAssetValidationError(
        "El contenedor WebP es inconsistente o contiene datos anexos."
      );
    }
    return "image/webp";
  }
  throw new ProposalAssetValidationError(
    "Los bytes no corresponden a una imagen PNG, JPEG o WebP válida."
  );
}

export type PreparedPrivateProposalImage = {
  bytes: Buffer;
  height: number;
  mimeType: ProposalAssetMimeType;
  sha256: string;
  sizeBytes: number;
  width: number;
};

export async function preparePrivateProposalImage(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  originalFileName: string;
}): Promise<PreparedPrivateProposalImage> {
  const config = getProposalAssetConfig();
  if (!input.bytes.byteLength || input.bytes.byteLength > config.maxFileBytes) {
    throw new ProposalAssetValidationError(
      "El archivo excede el límite permitido de 15 MiB."
    );
  }
  const extensionMimeType = declaredMimeForFileName(input.originalFileName);
  const magicMimeType = detectedMimeType(input.bytes);
  if (input.declaredMimeType !== magicMimeType || extensionMimeType !== magicMimeType) {
    throw new ProposalAssetValidationError(
      "La extensión, el MIME declarado y los bytes de la imagen deben coincidir."
    );
  }
  try {
    const decoder = sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: proposalAssetLimits.maxPixels,
      sequentialRead: true
    });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages && metadata.pages > 1)) {
      throw new ProposalAssetValidationError(
        "La imagen debe ser una imagen estática y decodificable."
      );
    }
    if (
      metadata.width > proposalAssetLimits.maxDimension ||
      metadata.height > proposalAssetLimits.maxDimension ||
      metadata.width * metadata.height > proposalAssetLimits.maxPixels
    ) {
      throw new ProposalAssetValidationError(
        "Las dimensiones de la imagen exceden el límite permitido."
      );
    }
    const transformer = decoder.rotate().resize({
      fit: "inside",
      height: proposalAssetLimits.maxThumbnailDimension,
      width: proposalAssetLimits.maxThumbnailDimension,
      withoutEnlargement: true
    });
    if (magicMimeType === "image/png") {
      transformer.png({ compressionLevel: 9, palette: false });
    } else if (magicMimeType === "image/jpeg") {
      transformer.jpeg({ mozjpeg: true, quality: 88 });
    } else {
      transformer.webp({ effort: 4, quality: 88 });
    }
    const result = await transformer.toBuffer({ resolveWithObject: true });
    if (
      !result.info.width ||
      !result.info.height ||
      result.data.byteLength > config.maxFileBytes
    ) {
      throw new ProposalAssetValidationError(
        "La variante segura de la imagen no es válida."
      );
    }
    return {
      bytes: result.data,
      height: result.info.height,
      mimeType: magicMimeType,
      sha256: createHash("sha256").update(result.data).digest("hex"),
      sizeBytes: result.data.byteLength,
      width: result.info.width
    };
  } catch (error) {
    if (error instanceof ProposalAssetValidationError) {
      throw error;
    }
    throw new ProposalAssetValidationError(
      "La imagen está corrupta, truncada o no pudo decodificarse."
    );
  }
}
