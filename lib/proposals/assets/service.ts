import { randomUUID } from "node:crypto";

import { database } from "@/lib/database";
import { proposalStatus } from "@/lib/proposals/proposal-state";
import { janvierDocumentSchema, type JanvierDocument } from "@/lib/proposals/markdown";

import { getProposalAssetConfig, proposalAssetLimits } from "./config";
import {
  assertProposalAssetAlias,
  preparePrivateProposalImage,
  type ProposalAssetMimeType,
  ProposalAssetValidationError
} from "./image";
import { getProposalAssetStorage, type ProposalAssetStorage } from "./storage";
import {
  auditMarkdownAssetReferences,
  type AdminProposalAssetManifestItem,
  type ProposalAssetAuditInput
} from "./manifest";

export type {
  AdminProposalAssetManifestItem,
  MarkdownAssetReport,
  PublicProposalAssetManifestItem
} from "./manifest";

export type AdminProposalAssetManagerItem = AdminProposalAssetManifestItem & {
  createdAt: string;
  id: string;
  originalFileName: string;
  sizeBytes: number;
};

export type PrivateProposalAssetDelivery = {
  asset: {
    alias: string;
    blob: {
      mimeType: ProposalAssetMimeType;
      sha256: string;
      sizeBytes: number;
      storageKey: string;
    };
    id: string;
    proposalId: string;
    revisionId: string;
  };
};

export class ProposalAssetError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ProposalAssetError";
  }
}

type RevisionAsset = ProposalAssetAuditInput;

function safeEventMetadata(asset: {
  alias: string;
  blob: { sha256: string; sizeBytes: number };
}) {
  return {
    alias: asset.alias,
    sha256Prefix: asset.blob.sha256.slice(0, 12),
    sizeBytes: asset.blob.sizeBytes
  };
}

function toManifest(asset: RevisionAsset): AdminProposalAssetManifestItem {
  const mimeType = asset.blob.mimeType as ProposalAssetMimeType;
  return {
    accessUrl: `/api/proposals/assets/${asset.id}`,
    alias: asset.alias,
    altText: asset.isDecorative ? "" : asset.altText,
    height: asset.blob.height,
    isDecorative: asset.isDecorative,
    isRequired: asset.isRequired,
    mimeType,
    removed: Boolean(asset.removedAt),
    sha256: asset.blob.sha256,
    width: asset.blob.width
  };
}

function toManagerItem(
  asset: RevisionAsset & { createdAt: Date; originalFileName: string }
) {
  return {
    ...toManifest(asset),
    createdAt: asset.createdAt.toISOString(),
    id: asset.id,
    originalFileName: asset.originalFileName,
    sizeBytes: asset.blob.sizeBytes
  } satisfies AdminProposalAssetManagerItem;
}

async function editableRevision(revisionId: string) {
  const revision = await database.proposalRevision.findUnique({
    include: {
      assets: { include: { blob: true }, orderBy: { createdAt: "asc" } },
      proposal: { select: { id: true, status: true } }
    },
    where: { id: revisionId }
  });
  if (
    !revision ||
    revision.lockedAt ||
    revision.proposal.status !== proposalStatus.DRAFT
  ) {
    throw new ProposalAssetError(
      "REVISION_LOCKED",
      "Los activos sólo se pueden modificar en una revisión DRAFT."
    );
  }
  return revision;
}

function assertAltText(altText: string, isDecorative: boolean) {
  const value = altText.trim();
  if (value.length > 500) {
    throw new ProposalAssetValidationError("El texto alternativo supera 500 caracteres.");
  }
  if (!isDecorative && !value) {
    throw new ProposalAssetValidationError(
      "Las imágenes informativas requieren texto alternativo antes de cargarse."
    );
  }
  return isDecorative ? "" : value;
}

function generatedStorageKey() {
  return `blobs/${randomUUID().replaceAll("-", "").slice(0, 4)}/${randomUUID().replaceAll("-", "")}`;
}

async function assertCapacity(
  revisionId: string,
  sizeBytes: number,
  ignoreAssetId?: string
) {
  const assets = await database.proposalAsset.findMany({
    include: { blob: { select: { sizeBytes: true } } },
    where: {
      ...(ignoreAssetId ? { id: { not: ignoreAssetId } } : {}),
      removedAt: null,
      revisionId
    }
  });
  if (assets.length >= proposalAssetLimits.maxAssetsPerRevision) {
    throw new ProposalAssetError(
      "ASSET_LIMIT",
      "La revisión ya tiene 50 activos activos."
    );
  }
  const total = assets.reduce((sum, asset) => sum + asset.blob.sizeBytes, 0) + sizeBytes;
  if (total > getProposalAssetConfig().maxRevisionBytes) {
    throw new ProposalAssetError(
      "REVISION_SIZE_LIMIT",
      "La revisión excedería el límite total de activos."
    );
  }
}

async function findOrWriteBlob(
  prepared: Awaited<ReturnType<typeof preparePrivateProposalImage>>,
  storage: ProposalAssetStorage
) {
  const current = await database.proposalAssetBlob.findUnique({
    where: { sha256: prepared.sha256 }
  });
  if (current) {
    if (!(await storage.exists(current.storageKey))) {
      throw new ProposalAssetError(
        "BLOB_MISSING",
        "El blob deduplicado no existe en almacenamiento privado."
      );
    }
    return { blob: current, wroteStorage: false };
  }
  const storageKey = generatedStorageKey();
  await storage.put({ bytes: prepared.bytes, storageKey });
  return {
    blob: {
      createdAt: new Date(),
      height: prepared.height,
      id: "",
      mimeType: prepared.mimeType,
      sha256: prepared.sha256,
      sizeBytes: prepared.sizeBytes,
      storageKey,
      width: prepared.width
    },
    wroteStorage: true
  };
}

export async function uploadPrivateProposalAsset(input: {
  alias: string;
  altText: string;
  bytes: Uint8Array;
  declaredMimeType: string;
  isDecorative: boolean;
  isRequired: boolean;
  originalFileName: string;
  revisionId: string;
  uploadedByAdminId: string;
}) {
  const alias = assertProposalAssetAlias(input.alias);
  const altText = assertAltText(input.altText, input.isDecorative);
  await editableRevision(input.revisionId);
  const prepared = await preparePrivateProposalImage(input);
  await assertCapacity(input.revisionId, prepared.sizeBytes);
  const storage = getProposalAssetStorage();
  const candidate = await findOrWriteBlob(prepared, storage);
  try {
    const result = await database.$transaction(async (transaction) => {
      const revision = await transaction.proposalRevision.findUnique({
        include: { proposal: { select: { id: true, status: true } } },
        where: { id: input.revisionId }
      });
      if (
        !revision ||
        revision.lockedAt ||
        revision.proposal.status !== proposalStatus.DRAFT
      ) {
        throw new ProposalAssetError(
          "REVISION_LOCKED",
          "La revisión dejó de ser editable."
        );
      }
      let blob = await transaction.proposalAssetBlob.findUnique({
        where: { sha256: prepared.sha256 }
      });
      const reused = Boolean(blob);
      if (!blob) {
        blob = await transaction.proposalAssetBlob.create({
          data: {
            height: prepared.height,
            mimeType: prepared.mimeType,
            sha256: prepared.sha256,
            sizeBytes: prepared.sizeBytes,
            storageKey: candidate.blob.storageKey,
            width: prepared.width
          }
        });
      }
      const asset = await transaction.proposalAsset.create({
        data: {
          alias,
          altText,
          blobId: blob.id,
          isDecorative: input.isDecorative,
          isRequired: input.isRequired,
          originalFileName: input.originalFileName,
          revisionId: input.revisionId,
          uploadedByAdminId: input.uploadedByAdminId
        },
        include: { blob: true }
      });
      await transaction.proposalEvent.create({
        data: {
          adminActorId: input.uploadedByAdminId,
          metadata: safeEventMetadata(asset),
          proposalId: revision.proposal.id,
          revisionId: input.revisionId,
          type: "PROPOSAL_ASSET_UPLOADED"
        }
      });
      if (reused) {
        await transaction.proposalEvent.create({
          data: {
            adminActorId: input.uploadedByAdminId,
            metadata: safeEventMetadata(asset),
            proposalId: revision.proposal.id,
            revisionId: input.revisionId,
            type: "PROPOSAL_ASSET_BLOB_REUSED"
          }
        });
      }
      return { asset, reused };
    });
    if (candidate.wroteStorage && result.reused) {
      await storage.delete(candidate.blob.storageKey).catch(() => undefined);
    }
    return {
      assetId: result.asset.id,
      manifest: toManifest({ ...result.asset, removedAt: result.asset.removedAt }),
      reused: result.reused
    };
  } catch (error) {
    if (candidate.wroteStorage) {
      await storage.delete(candidate.blob.storageKey).catch(() => undefined);
    }
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ProposalAssetError(
        "ASSET_CONFLICT",
        "El alias o blob fue creado por otra sesión. Actualiza e intenta de nuevo."
      );
    }
    throw error;
  }
}

async function assetForEdit(assetId: string) {
  const asset = await database.proposalAsset.findUnique({
    include: { blob: true, revision: { include: { proposal: true } } },
    where: { id: assetId }
  });
  if (
    !asset ||
    asset.revision.lockedAt ||
    asset.revision.proposal.status !== proposalStatus.DRAFT
  ) {
    throw new ProposalAssetError(
      "REVISION_LOCKED",
      "El activo no pertenece a una revisión editable."
    );
  }
  return asset;
}

export async function updatePrivateProposalAsset(input: {
  alias?: string;
  altText?: string;
  confirmAliasChange?: boolean;
  isDecorative?: boolean;
  isRequired?: boolean;
  assetId: string;
  adminId: string;
}) {
  const asset = await assetForEdit(input.assetId);
  const nextAlias =
    input.alias === undefined ? asset.alias : assertProposalAssetAlias(input.alias);
  const nextDecorative = input.isDecorative ?? asset.isDecorative;
  const nextAltText = assertAltText(input.altText ?? asset.altText, nextDecorative);
  const source = await database.proposalMarkdownSource.findUnique({
    select: { sourceMarkdown: true },
    where: { revisionId: asset.revisionId }
  });
  const referenceCount =
    source?.sourceMarkdown.match(new RegExp(`asset:${asset.alias}\\b`, "gu"))?.length ??
    0;
  if (nextAlias !== asset.alias && referenceCount && !input.confirmAliasChange) {
    throw new ProposalAssetError(
      "ASSET_ALIAS_REFERENCED",
      `El alias aparece ${referenceCount} vez/veces en Markdown y debe confirmarse explícitamente.`
    );
  }
  const updated = await database.$transaction(async (transaction) => {
    const next = await transaction.proposalAsset.update({
      data: {
        alias: nextAlias,
        altText: nextAltText,
        isDecorative: nextDecorative,
        ...(input.isRequired === undefined ? {} : { isRequired: input.isRequired })
      },
      include: { blob: true },
      where: { id: asset.id }
    });
    const type =
      nextAlias !== asset.alias
        ? "PROPOSAL_ASSET_ALIAS_CHANGED"
        : input.isRequired !== undefined && input.isRequired !== asset.isRequired
          ? "PROPOSAL_ASSET_REQUIRED_CHANGED"
          : "PROPOSAL_ASSET_ALT_UPDATED";
    await transaction.proposalEvent.create({
      data: {
        adminActorId: input.adminId,
        metadata: safeEventMetadata(next),
        proposalId: asset.revision.proposalId,
        revisionId: asset.revisionId,
        type
      }
    });
    return next;
  });
  return toManifest({ ...updated, removedAt: updated.removedAt });
}

export async function removePrivateProposalAsset(assetId: string, adminId: string) {
  const asset = await assetForEdit(assetId);
  const removed = await database.proposalAsset.update({
    data: { removedAt: new Date() },
    include: { blob: true },
    where: { id: asset.id }
  });
  await database.proposalEvent.create({
    data: {
      adminActorId: adminId,
      metadata: safeEventMetadata(removed),
      proposalId: asset.revision.proposalId,
      revisionId: asset.revisionId,
      type: "PROPOSAL_ASSET_REMOVED"
    }
  });
  return toManifest({ ...removed, removedAt: removed.removedAt });
}

export async function restorePrivateProposalAsset(assetId: string, adminId: string) {
  const asset = await assetForEdit(assetId);
  await assertCapacity(asset.revisionId, asset.blob.sizeBytes, asset.id);
  const restored = await database.proposalAsset.update({
    data: { removedAt: null },
    include: { blob: true },
    where: { id: asset.id }
  });
  await database.proposalEvent.create({
    data: {
      adminActorId: adminId,
      metadata: safeEventMetadata(restored),
      proposalId: asset.revision.proposalId,
      revisionId: asset.revisionId,
      type: "PROPOSAL_ASSET_RESTORED"
    }
  });
  return toManifest({ ...restored, removedAt: restored.removedAt });
}

export async function replacePrivateProposalAsset(input: {
  assetId: string;
  bytes: Uint8Array;
  declaredMimeType: string;
  originalFileName: string;
  adminId: string;
}) {
  const asset = await assetForEdit(input.assetId);
  const prepared = await preparePrivateProposalImage(input);
  await assertCapacity(asset.revisionId, prepared.sizeBytes, asset.id);
  const storage = getProposalAssetStorage();
  const candidate = await findOrWriteBlob(prepared, storage);
  try {
    const updated = await database.$transaction(async (transaction) => {
      let blob = await transaction.proposalAssetBlob.findUnique({
        where: { sha256: prepared.sha256 }
      });
      const reused = Boolean(blob);
      if (!blob) {
        blob = await transaction.proposalAssetBlob.create({
          data: {
            height: prepared.height,
            mimeType: prepared.mimeType,
            sha256: prepared.sha256,
            sizeBytes: prepared.sizeBytes,
            storageKey: candidate.blob.storageKey,
            width: prepared.width
          }
        });
      }
      const next = await transaction.proposalAsset.update({
        data: { blobId: blob.id, originalFileName: input.originalFileName },
        include: { blob: true },
        where: { id: asset.id }
      });
      await transaction.proposalEvent.create({
        data: {
          adminActorId: input.adminId,
          metadata: safeEventMetadata(next),
          proposalId: asset.revision.proposalId,
          revisionId: asset.revisionId,
          type: "PROPOSAL_ASSET_REPLACED"
        }
      });
      return { next, reused };
    });
    return {
      manifest: toManifest({ ...updated.next, removedAt: updated.next.removedAt }),
      reused: updated.reused
    };
  } catch (error) {
    if (candidate.wroteStorage) {
      await storage.delete(candidate.blob.storageKey).catch(() => undefined);
    }
    throw error;
  }
}

export async function getProposalAssetManifest(
  revisionId: string,
  includeRemoved = false
) {
  const assets = (await database.proposalAsset.findMany({
    include: { blob: true },
    orderBy: { createdAt: "asc" },
    where: { revisionId, ...(includeRemoved ? {} : { removedAt: null }) }
  })) as RevisionAsset[];
  return assets.map(toManifest);
}

export async function getProposalAssetAdminItems(revisionId: string) {
  const assets = await database.proposalAsset.findMany({
    include: { blob: true },
    orderBy: { createdAt: "asc" },
    where: { revisionId }
  });
  return assets.map((asset) => toManagerItem({ ...asset, removedAt: asset.removedAt }));
}

export async function getProposalAssetAdminItem(assetId: string) {
  const asset = await database.proposalAsset.findUnique({
    include: { blob: true },
    where: { id: assetId }
  });
  return asset ? toManagerItem({ ...asset, removedAt: asset.removedAt }) : null;
}

/**
 * This intentionally returns the storage key only to a server-side delivery
 * route. Renderer manifests never include it.
 */
export async function getPrivateProposalAssetDelivery(
  assetId: string
): Promise<PrivateProposalAssetDelivery | null> {
  const asset = await database.proposalAsset.findUnique({
    include: {
      blob: {
        select: { mimeType: true, sha256: true, sizeBytes: true, storageKey: true }
      },
      revision: { select: { proposalId: true } }
    },
    where: { id: assetId }
  });
  if (!asset) {
    return null;
  }
  return {
    asset: {
      alias: asset.alias,
      blob: {
        ...asset.blob,
        mimeType: asset.blob.mimeType as ProposalAssetMimeType
      },
      id: asset.id,
      proposalId: asset.revision.proposalId,
      revisionId: asset.revisionId
    }
  };
}

export async function recordPrivateProposalAssetAccess(assetId: string, adminId: string) {
  const delivery = await getPrivateProposalAssetDelivery(assetId);
  if (!delivery) {
    return;
  }
  await database.proposalEvent.create({
    data: {
      adminActorId: adminId,
      metadata: {
        alias: delivery.asset.alias,
        sha256Prefix: delivery.asset.blob.sha256.slice(0, 12),
        sizeBytes: delivery.asset.blob.sizeBytes
      },
      proposalId: delivery.asset.proposalId,
      revisionId: delivery.asset.revisionId,
      type: "PROPOSAL_ASSET_ACCESSED"
    }
  });
}

export async function getProposalAssetShareBlockers(revisionId: string) {
  const source = await database.proposalMarkdownSource.findUnique({
    select: { normalizedAst: true },
    where: { revisionId }
  });
  const parsed = source ? janvierDocumentSchema.safeParse(source.normalizedAst) : null;
  if (!parsed?.success) {
    return [];
  }
  const report = await getProposalMarkdownAssetReport(revisionId, parsed.data);
  const assets = await database.proposalAsset.findMany({
    select: { alias: true, isRequired: true, removedAt: true },
    where: { revisionId }
  });
  const used = new Set(report.usedAliases);
  return assets
    .filter((asset) => asset.isRequired)
    .filter((asset) => asset.removedAt || !used.has(asset.alias))
    .map((asset) => asset.alias);
}

export async function getProposalMarkdownAssetReport(
  revisionId: string,
  document: JanvierDocument
) {
  const assets = (await database.proposalAsset.findMany({
    include: { blob: true },
    where: { revisionId }
  })) as RevisionAsset[];
  return auditMarkdownAssetReferences(document, assets);
}
