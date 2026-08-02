import "dotenv/config";

import { database } from "../../lib/database";
import {
  isLegacyProvisionalAst,
  prepareLegacyMarkdownBackfill
} from "../../lib/proposals/markdown/backfill";

type BackfillCounts = {
  analyzed: number;
  errors: number;
  hashMismatches: number;
  valid: number;
  warnings: number;
};

function parseArguments(args: string[]) {
  const supported = new Set(["--dry-run"]);
  const unsupported = args.filter((argument) => !supported.has(argument));
  if (unsupported.length) {
    throw new Error("Uso: npm run proposals:backfill-markdown -- [--dry-run]");
  }
  return { dryRun: args.includes("--dry-run") };
}

function addResultCount(counts: BackfillCounts, status: "VALID" | "WARNINGS" | "ERROR") {
  if (status === "VALID") {
    counts.valid += 1;
  } else if (status === "WARNINGS") {
    counts.warnings += 1;
  } else {
    counts.errors += 1;
  }
}

async function main() {
  const { dryRun } = parseArguments(process.argv.slice(2));
  const legacySources = await database.proposalMarkdownSource.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      normalizedAst: true,
      revisionId: true,
      sourceHash: true,
      sourceMarkdown: true
    },
    where: { parserVersion: "legacy-generated-v1" }
  });
  const candidates = legacySources.filter((source) => isLegacyProvisionalAst(source.normalizedAst));
  const counts: BackfillCounts = {
    analyzed: 0,
    errors: 0,
    hashMismatches: 0,
    valid: 0,
    warnings: 0
  };
  const report: Array<{
    hash: "MATCH" | "MISMATCH";
    revisionId: string;
    sourceId: string;
    status: "VALID" | "WARNINGS" | "ERROR";
    write: "UPDATED" | "SKIPPED";
  }> = [];

  for (const source of candidates) {
    const prepared = prepareLegacyMarkdownBackfill(source);
    counts.analyzed += 1;
    addResultCount(counts, prepared.result.status);

    if (!prepared.hashMatches) {
      counts.hashMismatches += 1;
      report.push({
        hash: "MISMATCH",
        revisionId: source.revisionId,
        sourceId: source.id,
        status: prepared.result.status,
        write: "SKIPPED"
      });
      continue;
    }

    if (!dryRun) {
      // Deliberately touch only parser-owned fields. Proposal state, locks,
      // invitations, decisions, acceptances and historical hashes are out of scope.
      await database.proposalMarkdownSource.update({
        data: prepared.update,
        where: { id: source.id }
      });
    }

    report.push({
      hash: "MATCH",
      revisionId: source.revisionId,
      sourceId: source.id,
      status: prepared.result.status,
      write: dryRun ? "SKIPPED" : "UPDATED"
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        legacySources: legacySources.length,
        pendingSources: candidates.length,
        ...counts
      },
      null,
      2
    )
  );
  if (report.length) {
    console.table(report);
  }

  if (counts.hashMismatches) {
    process.exitCode = 1;
    console.error(
      "BACKFILL_HASH_MISMATCH: no se actualizó ninguna fuente cuyo hash histórico no coincide."
    );
  }
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : error);
  })
  .finally(async () => {
    await database.$disconnect();
  });
