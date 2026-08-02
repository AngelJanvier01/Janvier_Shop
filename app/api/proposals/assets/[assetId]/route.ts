import { Readable } from "node:stream";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import {
  getPrivateProposalAssetDelivery,
  getProposalAssetStorage,
  recordPrivateProposalAssetAccess
} from "@/lib/proposals/assets";

export const runtime = "nodejs";

function contentExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return new Response("No autorizado.", { status: 401 });
  }
  const { assetId } = await context.params;
  const delivery = await getPrivateProposalAssetDelivery(assetId);
  if (!delivery) {
    return new Response("No encontrado.", { status: 404 });
  }
  const etag = `\"${delivery.asset.blob.sha256}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      headers: {
        "Cache-Control": "private, max-age=300, must-revalidate",
        ETag: etag,
        "X-Content-Type-Options": "nosniff"
      },
      status: 304
    });
  }
  try {
    const stream = await getProposalAssetStorage().open(delivery.asset.blob.storageKey);
    await recordPrivateProposalAssetAccess(assetId, admin.id).catch(() => undefined);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, max-age=300, must-revalidate",
        "Content-Disposition": `inline; filename=\"asset-${delivery.asset.alias}.${contentExtension(delivery.asset.blob.mimeType)}\"`,
        "Content-Length": String(delivery.asset.blob.sizeBytes),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": delivery.asset.blob.mimeType,
        ETag: etag,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new Response("Activo privado no disponible.", { status: 503 });
  }
}
