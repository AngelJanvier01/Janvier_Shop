import "dotenv/config";

import { database } from "../../lib/database";
import { checkpointRetentionPlan } from "../../lib/proposals/markdown/history";

const apply = process.argv.includes("--apply");

const checkpoints = await database.proposalMarkdownCheckpoint.findMany({
  include: {
    acceptanceEvidence: { select: { id: true } },
    source: { select: { revisionId: true, revision: { select: { proposalId: true } } } }
  },
  orderBy: [{ sourceId: "asc" }, { sequence: "desc" }]
});

const bySource = new Map<string, typeof checkpoints>();
for (const checkpoint of checkpoints) {
  const group = bySource.get(checkpoint.sourceId) ?? [];
  group.push(checkpoint);
  bySource.set(checkpoint.sourceId, group);
}

let deletable = 0;
for (const [sourceId, group] of bySource) {
  const plan = checkpointRetentionPlan(
    group.map((checkpoint) => ({
      createdAt: checkpoint.createdAt,
      id: checkpoint.id,
      reason: checkpoint.reason,
      sequence: checkpoint.sequence
    }))
  );
  const protectedIds = new Set(
    group
      .filter((checkpoint) => checkpoint.acceptanceEvidence.length)
      .map((checkpoint) => checkpoint.id)
  );
  const deleteIds = plan.deleteIds.filter((checkpointId) => !protectedIds.has(checkpointId));
  if (!deleteIds.length) {
    continue;
  }
  deletable += deleteIds.length;
  console.log(`${apply ? "PRUNE" : "DRY_RUN"} source=${sourceId} checkpoints=${deleteIds.length}`);
  if (!apply) {
    continue;
  }
  const proposalId = group[0]?.source.revision.proposalId;
  await database.$transaction(async (transaction) => {
    await transaction.proposalMarkdownCheckpoint.deleteMany({
      where: { id: { in: deleteIds }, sourceId }
    });
    if (proposalId) {
      await transaction.proposalEvent.create({
        data: {
          metadata: {
            checkpointIds: deleteIds,
            protectedCheckpointIds: [...protectedIds],
            operation: "MARKDOWN_CHECKPOINT_RETENTION",
            retainedCheckpointIds: plan.retainedIds,
            sourceId
          },
          proposalId,
          revisionId: group[0]?.source.revisionId,
          type: "PROPOSAL_EDITED"
        }
      });
    }
  });
}

console.log(`${apply ? "PRUNED" : "DRY_RUN_COMPLETE"} checkpoints=${deletable}`);
await database.$disconnect();
