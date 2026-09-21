import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { readProductImageVariant } from "@/lib/product-images/storage";

const contentTypes: Record<string, string> = {
  avif: "image/avif",
  png: "image/png",
  webp: "image/webp"
};

const unavailableImageSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="title description">
  <title id="title">Imagen no disponible</title>
  <desc id="description">La imagen del producto se actualizará próximamente.</desc>
  <rect width="1200" height="900" fill="#f1f0eb"/>
  <rect x="360" y="240" width="480" height="320" rx="8" fill="none" stroke="#8a887f" stroke-width="8"/>
  <circle cx="490" cy="350" r="42" fill="none" stroke="#8a887f" stroke-width="8"/>
  <path d="M390 520l145-135 105 92 70-65 100 108" fill="none" stroke="#8a887f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="600" y="655" fill="#1c1c1a" font-family="Arial, sans-serif" font-size="32" letter-spacing="5" text-anchor="middle">IMAGEN POR ACTUALIZAR</text>
</svg>`.trim();

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string; variant: string }> }
) {
  const { assetId, variant } = await context.params;
  const contentType = contentTypes[variant];
  if (!contentType) return new Response("Not found", { status: 404 });

  const asset = await database.productImageDerivative.findFirst({
    select: { reviewedAt: true, status: true, storageKey: true },
    where: {
      id: assetId,
      status: { in: ["READY", "APPROVED", "PENDING", "PROCESSING", "RETRY"] },
      storageKey: { not: null }
    }
  });
  if (!asset?.storageKey) return new Response("Not found", { status: 404 });
  const retainsReviewedLocalVariant =
    asset.reviewedAt !== null &&
    (asset.status === "PENDING" ||
      asset.status === "PROCESSING" ||
      asset.status === "RETRY");
  const canServePublicly = asset.status === "APPROVED" || retainsReviewedLocalVariant;
  if (!canServePublicly && !(await getCurrentAdmin())) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const contents = await readProductImageVariant(asset.storageKey, variant);
    return new Response(contents, {
      headers: {
        "cache-control": canServePublicly
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
        "content-type": contentType,
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    if (canServePublicly) {
      return new Response(unavailableImageSvg, {
        headers: {
          "cache-control": "no-store",
          "content-type": "image/svg+xml; charset=utf-8",
          "x-content-type-options": "nosniff",
          "x-janvier-image-fallback": "missing-storage-object"
        }
      });
    }
    return new Response("Not found", { status: 404 });
  }
}
