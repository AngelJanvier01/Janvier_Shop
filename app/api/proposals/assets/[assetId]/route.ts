import { Readable } from "node:stream";
import { cookies } from "next/headers";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  getPrivateProposalAssetDelivery,
  getProposalAssetStorage,
  recordPrivateProposalAssetAccess
} from "@/lib/proposals/assets";
import {
  proposalAccessCookieName,
  readProposalAccessCookieIdentity
} from "@/lib/proposals/invite-access";
import { hashInviteToken } from "@/lib/proposals/invite-security";
import { canReadProjectRoom } from "@/lib/proposals/proposal-state";

export const runtime = "nodejs";

function contentExtension(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

async function hasActiveProposalAssetAccess(input: {
  proposalId: string;
  revisionId: string;
}) {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith("janvier_proposal_")) {
      continue;
    }
    const identity = readProposalAccessCookieIdentity(cookie.value);
    if (!identity || cookie.name !== proposalAccessCookieName(identity.token)) {
      continue;
    }
    const invite = await database.proposalInvite.findUnique({
      include: { proposal: { select: { status: true } } },
      where: { tokenHash: hashInviteToken(identity.token) }
    });
    if (
      invite &&
      invite.proposalId === input.proposalId &&
      invite.revisionId === input.revisionId &&
      invite.status === "ACTIVE" &&
      invite.expiresAt.getTime() > Date.now() &&
      canReadProjectRoom(invite.proposal.status)
    ) {
      return true;
    }
  }
  return false;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  const admin = await getCurrentAdmin();
  const { assetId } = await context.params;
  const delivery = await getPrivateProposalAssetDelivery(assetId);
  if (!delivery) {
    return new Response("No encontrado.", { status: 404 });
  }
  const proposalAccess = admin
    ? false
    : await hasActiveProposalAssetAccess({
        proposalId: delivery.asset.proposalId,
        revisionId: delivery.asset.revisionId
      });
  if (!admin && !proposalAccess) {
    return new Response("Acceso revocado o no autorizado.", { status: 401 });
  }
  const etag = `\"${delivery.asset.blob.sha256}\"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      headers: {
        "Cache-Control": "private, no-store",
        ETag: etag,
        "X-Content-Type-Options": "nosniff"
      },
      status: 304
    });
  }
  try {
    const stream = await getProposalAssetStorage().open(delivery.asset.blob.storageKey);
    if (admin) {
      await recordPrivateProposalAssetAccess(assetId, admin.id).catch(() => undefined);
    }
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, no-store",
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
