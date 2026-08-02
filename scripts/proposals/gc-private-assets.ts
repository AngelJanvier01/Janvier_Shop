import "dotenv/config";

import { database } from "../../lib/database";
import { getProposalAssetConfig, getProposalAssetStorage } from "../../lib/proposals/assets";

const execute = process.argv.includes("--execute");
const cutoff = new Date(Date.now() - getProposalAssetConfig().gcGraceDays * 24 * 60 * 60 * 1000);

type Candidate = {
  createdAt: Date;
  id: string;
  references: Array<{
    alias: string;
    removedAt: Date | null;
    revision: { proposalId: string };
    revisionId: string;
  }>;
  sha256: string;
  sizeBytes: number;
  storageKey: string;
};

function collectible(blob: Candidate) {
  return blob.createdAt <= cutoff && blob.references.every((reference) =>
    reference.removedAt !== null && reference.removedAt <= cutoff
  );
}

async function logFailure(candidate: Candidate, error: unknown) {
  await Promise.all(candidate.references.map((reference) =>
    database.proposalEvent.create({
      data: {
        metadata: {
          alias: reference.alias,
          reason: error instanceof Error ? error.message.slice(0, 240) : "unknown_gc_error",
          sha256Prefix: candidate.sha256.slice(0, 12)
        },
        proposalId: reference.revision.proposalId,
        revisionId: reference.revisionId,
        type: "PROPOSAL_ASSET_GC_FAILED"
      }
    }).catch(() => undefined)
  ));
}

const blobs = await database.proposalAssetBlob.findMany({
  include: {
    references: {
      include: { revision: { select: { proposalId: true } } },
      orderBy: { removedAt: "asc" }
    }
  }
});
const candidates = blobs.filter(collectible);

console.log(JSON.stringify({
  candidates: candidates.map((blob) => ({
    id: blob.id,
    references: blob.references.length,
    sha256Prefix: blob.sha256.slice(0, 12),
    sizeBytes: blob.sizeBytes
  })),
  cutoff: cutoff.toISOString(),
  dryRun: !execute,
  graceDays: getProposalAssetConfig().gcGraceDays
}, null, 2));

if (!execute) {
  await database.$disconnect();
  process.exit(0);
}

const storage = getProposalAssetStorage();
let deleted = 0;
let failed = 0;
for (const candidate of candidates) {
  try {
    const removed = await database.$transaction(async (transaction) => {
      // The lock blocks a concurrent FK reference until this maintenance action
      // either deletes the immutable blob or rolls back.
      await transaction.$queryRaw`SELECT "id" FROM "ProposalAssetBlob" WHERE "id" = ${candidate.id} FOR UPDATE`;
      const current = await transaction.proposalAssetBlob.findUnique({
        include: {
          references: {
            include: { revision: { select: { proposalId: true } } }
          }
        },
        where: { id: candidate.id }
      });
      if (!current || !collectible(current)) {
        return false;
      }
      await storage.delete(current.storageKey);
      await Promise.all(current.references.map((reference) =>
        transaction.proposalEvent.create({
          data: {
            metadata: {
              alias: reference.alias,
              sha256Prefix: current.sha256.slice(0, 12),
              sizeBytes: current.sizeBytes
            },
            proposalId: reference.revision.proposalId,
            revisionId: reference.revisionId,
            type: "PROPOSAL_ASSET_GC_DELETED"
          }
        })
      ));
      await transaction.proposalAssetBlob.delete({ where: { id: current.id } });
      return true;
    });
    if (removed) {
      deleted += 1;
    }
  } catch (error) {
    failed += 1;
    await logFailure(candidate, error);
  }
}

console.log(JSON.stringify({ deleted, failed }, null, 2));
await database.$disconnect();
if (failed) {
  process.exitCode = 1;
}
