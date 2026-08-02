import { createHash } from "node:crypto";

import type { StoredProposalSectionType } from "./schemas";

export type LegacyProposalSection = {
  content: string | null;
  id: string;
  position: number;
  title: string;
  type: StoredProposalSectionType;
};

function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function generateLegacyMarkdownSource(input: {
  sections: LegacyProposalSection[];
  title: string;
}) {
  const heading = `# ${oneLine(input.title) || "Propuesta JANVIER"}`;
  const sections = [...input.sections]
    .sort((left, right) => left.position - right.position)
    .map((section) => {
      const content = section.content?.trim();
      const title = oneLine(section.title) || "Sección";
      const block = `## ${title} {#legacy-${section.id} type=${section.type}}`;
      return content ? `${block}\n\n${content}` : block;
    });

  return [heading, ...sections].join("\n\n").concat("\n");
}

export function hashMarkdownSource(sourceMarkdown: string) {
  return createHash("sha256").update(sourceMarkdown, "utf8").digest("hex");
}
