import type { JanvierDocument, SafeMarkdownNode } from "@/lib/proposals/markdown";

import type { ProposalAssetMimeType } from "./image";

export type PublicProposalAssetManifestItem = {
  accessUrl: string;
  alias: string;
  altText: string;
  height: number | null;
  mimeType: ProposalAssetMimeType;
  sha256: string;
  width: number | null;
};

export type AdminProposalAssetManifestItem = PublicProposalAssetManifestItem & {
  isDecorative: boolean;
  isRequired: boolean;
  removed: boolean;
};

export type MarkdownAssetReport = {
  missingAliases: Array<{ alias: string; line: null; occurrences: number }>;
  requiredMissingAliases: string[];
  unresolvedAltAliases: string[];
  unusedAliases: string[];
  usedAliases: string[];
};

export type ProposalAssetAuditInput = {
  alias: string;
  altText: string;
  blob: {
    height: number | null;
    mimeType: string;
    sha256: string;
    sizeBytes: number;
    storageKey: string;
    width: number | null;
  };
  id: string;
  isDecorative: boolean;
  isRequired: boolean;
  removedAt: Date | null;
};

function collectImageNodes(
  nodes: SafeMarkdownNode[],
  references: Array<{ alias: string; alt: string }>
) {
  for (const node of nodes) {
    if (node.type === "image" && node.url?.startsWith("asset:")) {
      references.push({
        alias: node.url.slice("asset:".length),
        alt: node.alt?.trim() ?? ""
      });
    }
    if (node.children) {
      collectImageNodes(node.children, references);
    }
  }
}

export function auditMarkdownAssetReferences(
  document: JanvierDocument,
  assets: ProposalAssetAuditInput[]
): MarkdownAssetReport {
  const references: Array<{ alias: string; alt: string }> = [];
  collectImageNodes(document.preamble, references);
  for (const section of document.sections) {
    collectImageNodes(section.content, references);
  }
  const activeByAlias = new Map(
    assets.filter((asset) => !asset.removedAt).map((asset) => [asset.alias, asset])
  );
  const allByAlias = new Map(assets.map((asset) => [asset.alias, asset]));
  const countByAlias = new Map<string, number>();
  const unresolvedAltAliases = new Set<string>();
  for (const reference of references) {
    countByAlias.set(reference.alias, (countByAlias.get(reference.alias) ?? 0) + 1);
    const asset = activeByAlias.get(reference.alias);
    if (asset && !asset.isDecorative && !reference.alt && !asset.altText) {
      unresolvedAltAliases.add(reference.alias);
    }
  }
  const missingAliases = [...countByAlias]
    .filter(([alias]) => !activeByAlias.has(alias))
    .map(([alias, occurrences]) => ({ alias, line: null, occurrences }));
  const requiredMissingAliases = assets
    .filter((asset) => asset.isRequired && asset.removedAt)
    .map((asset) => asset.alias)
    .concat(
      missingAliases
        .filter(({ alias }) => allByAlias.get(alias)?.isRequired)
        .map(({ alias }) => alias)
    );
  return {
    missingAliases,
    requiredMissingAliases: [...new Set(requiredMissingAliases)],
    unresolvedAltAliases: [...unresolvedAltAliases],
    unusedAliases: assets
      .filter((asset) => !asset.removedAt && !countByAlias.has(asset.alias))
      .map((asset) => asset.alias),
    usedAliases: [...countByAlias.keys()].filter((alias) => activeByAlias.has(alias))
  };
}

export function publicAssetManifest(
  items: AdminProposalAssetManifestItem[]
): PublicProposalAssetManifestItem[] {
  return items
    .filter((item) => !item.removed)
    .map((item) => ({
      accessUrl: item.accessUrl,
      alias: item.alias,
      altText: item.altText,
      height: item.height,
      mimeType: item.mimeType,
      sha256: item.sha256,
      width: item.width
    }));
}
