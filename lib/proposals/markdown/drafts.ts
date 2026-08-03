import { database } from "../../database";
import { proposalStatus } from "../proposal-state";

import { assertMarkdownCanPersist } from "./persistence";
import { parseJanvierMarkdown } from "./parser";
import type {
  MarkdownDiagnostic,
  MarkdownParseResult,
  SafeMarkdownNode
} from "./schemas";

export type MarkdownDraftWriteReason =
  | "IMPORT"
  | "MANUAL_SAVE"
  | "REIMPORT_REPLACE"
  | "TEMPLATE_APPLIED"
  | "RESTORE";

export type MarkdownDraftWriteRequest = {
  expectedSourceHash: string | null;
  expectedVersion: number | null;
  originalFileName: string | null;
  reason: MarkdownDraftWriteReason;
  sourceMarkdown: string;
  sourceHash: string;
};

export type MarkdownDraftSourceState = {
  originalFileName: string | null;
  parseStatus: "PENDING_VALIDATION" | "VALID" | "WARNINGS" | "ERROR";
  sourceHash: string;
  sourceMarkdown: string;
  version: number;
};

export class MarkdownDraftConflictError extends Error {
  constructor(message = "La fuente cambió en otra sesión. Actualiza antes de guardar.") {
    super(message);
    this.name = "MarkdownDraftConflictError";
  }
}

export class MarkdownDraftNotEditableError extends Error {
  constructor() {
    super("Esta revisión ya no es un borrador editable.");
    this.name = "MarkdownDraftNotEditableError";
  }
}

export function analyzeMarkdownDraft(
  sourceMarkdown: string | Uint8Array
): MarkdownParseResult {
  return parseJanvierMarkdown(sourceMarkdown);
}

function plainText(nodes: SafeMarkdownNode[]): string {
  return nodes
    .map((node) => {
      if (typeof node.value === "string") {
        return node.value;
      }
      return node.children ? plainText(node.children) : "";
    })
    .join("")
    .trim();
}

function asSourceState(input: {
  originalFileName: string | null;
  parseStatus: "PENDING_VALIDATION" | "VALID" | "WARNINGS" | "ERROR";
  sourceHash: string;
  sourceMarkdown: string;
  version: number;
}): MarkdownDraftSourceState {
  return input;
}

function parserDiagnostics(result: MarkdownParseResult): MarkdownDiagnostic[] {
  return result.diagnostics;
}

/**
 * Persists a DRAFT source and synchronizes derived sections inside a single
 * transaction. Commercial data, proposal state and Project Room data stay out
 * of this flow.
 */
export async function persistMarkdownDraft(
  revisionId: string,
  adminId: string,
  request: MarkdownDraftWriteRequest
): Promise<MarkdownDraftSourceState> {
  const parsed = analyzeMarkdownDraft(request.sourceMarkdown);
  if (parsed.sourceHash !== request.sourceHash) {
    throw new MarkdownDraftConflictError(
      "El contenido ya no coincide con el análisis confirmado."
    );
  }
  const document = assertMarkdownCanPersist(parsed);
  const now = new Date();

  return database.$transaction(async (transaction) => {
    const revision = await transaction.proposalRevision.findUnique({
      include: {
        markdownSource: true,
        proposal: { select: { id: true, status: true } }
      },
      where: { id: revisionId }
    });
    if (
      !revision ||
      revision.lockedAt ||
      revision.proposal.status !== proposalStatus.DRAFT
    ) {
      throw new MarkdownDraftNotEditableError();
    }

    const current = revision.markdownSource;
    if (
      current &&
      (current.sourceHash !== request.expectedSourceHash ||
        current.version !== request.expectedVersion)
    ) {
      throw new MarkdownDraftConflictError();
    }
    if (
      !current &&
      (request.expectedSourceHash !== null || request.expectedVersion !== null)
    ) {
      throw new MarkdownDraftConflictError();
    }

    if (
      current &&
      current.sourceHash === parsed.sourceHash &&
      current.sourceMarkdown === parsed.normalizedSource
    ) {
      return asSourceState(current);
    }

    const sourceData = {
      lastParsedAt: now,
      normalizedAst: document,
      originalFileName: request.originalFileName,
      parseStatus: parsed.status,
      parseWarnings: parserDiagnostics(parsed),
      parserVersion: parsed.parserVersion,
      sourceHash: parsed.sourceHash,
      sourceMarkdown: parsed.normalizedSource
    };
    const source = current
      ? await (async () => {
          const updated = await transaction.proposalMarkdownSource.updateMany({
            data: { ...sourceData, version: { increment: 1 } },
            where: {
              id: current.id,
              sourceHash: request.expectedSourceHash ?? undefined,
              version: request.expectedVersion ?? undefined
            }
          });
          if (updated.count !== 1) {
            throw new MarkdownDraftConflictError();
          }
          return {
            id: current.id,
            version: current.version + 1
          };
        })()
      : await transaction.proposalMarkdownSource.create({
          data: {
            ...sourceData,
            importedAt: now,
            importedByAdminId: adminId,
            revisionId,
            version: 1
          },
          select: { id: true, version: true }
        });

    // Shift old positions once so replacement order cannot violate the unique
    // (revisionId, position) constraint while sourceIds are updated in place.
    await transaction.proposalSection.updateMany({
      data: { position: { increment: 1000 } },
      where: { revisionId }
    });
    const sourceIds = document.sections.map((section) => section.sourceId);
    await transaction.proposalSection.updateMany({
      data: { isIncluded: false, removedAt: now },
      where: {
        revisionId,
        sourceId: sourceIds.length ? { notIn: sourceIds } : undefined
      }
    });
    for (const [index, section] of document.sections.entries()) {
      const content = plainText(section.content) || null;
      await transaction.proposalSection.upsert({
        create: {
          content,
          contentAst: section.content,
          internalOnly: section.internalOnly,
          isIncluded: section.included,
          position: index + 1,
          revisionId,
          slug: section.slug,
          sourceEndLine: section.endLine,
          sourceId: section.sourceId,
          sourceStartLine: section.startLine,
          title: section.title,
          type: section.storageType
        },
        update: {
          content,
          contentAst: section.content,
          internalOnly: section.internalOnly,
          isIncluded: section.included,
          position: index + 1,
          removedAt: null,
          slug: section.slug,
          sourceEndLine: section.endLine,
          sourceStartLine: section.startLine,
          title: section.title,
          type: section.storageType
        },
        where: {
          revisionId_sourceId: { revisionId, sourceId: section.sourceId }
        }
      });
    }

    const checkpoint = await transaction.proposalMarkdownCheckpoint.findFirst({
      orderBy: { sequence: "desc" },
      select: { sequence: true },
      where: { sourceId: source.id }
    });
    await transaction.proposalMarkdownCheckpoint.create({
      data: {
        createdByAdminId: adminId,
        originalFileName: request.originalFileName,
        parseStatus: parsed.status,
        parseWarnings: parserDiagnostics(parsed),
        parserVersion: parsed.parserVersion,
        reason: current ? request.reason : "IMPORT",
        sequence: (checkpoint?.sequence ?? 0) + 1,
        sourceHash: parsed.sourceHash,
        sourceId: source.id,
        sourceMarkdown: parsed.normalizedSource
      }
    });
    const title = document.title?.trim() || revision.title;
    await transaction.proposalRevision.update({
      data: { title },
      where: { id: revisionId }
    });
    await transaction.proposal.update({
      data: { title },
      where: { id: revision.proposal.id }
    });
    await transaction.proposalEvent.create({
      data: {
        adminActorId: adminId,
        metadata: {
          markdownSourceHash: parsed.sourceHash,
          markdownVersion: source.version,
          reason: current ? request.reason : "IMPORT"
        },
        proposalId: revision.proposal.id,
        revisionId,
        type: "PROPOSAL_EDITED"
      }
    });

    return asSourceState({
      originalFileName: request.originalFileName,
      parseStatus: parsed.status,
      sourceHash: parsed.sourceHash,
      sourceMarkdown: parsed.normalizedSource,
      version: source.version
    });
  });
}
