import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { readProductImageVariant } from "@/lib/product-images/storage";

const contentTypes: Record<string, string> = {
  avif: "image/avif",
  png: "image/png",
  webp: "image/webp"
};

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
    return new Response("Not found", { status: 404 });
  }
}
