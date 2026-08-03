import { hashMarkdownSource } from "./legacy-source";

export type MarkdownCheckpointReason =
  | "IMPORT"
  | "REIMPORT_REPLACE"
  | "REIMPORT_MERGE"
  | "APPEND"
  | "MANUAL_SAVE"
  | "TEMPLATE_APPLIED"
  | "RESTORE"
  | "PRE_SHARE"
  | "REVISION_CLONED";

export type MarkdownLineDiff = {
  afterLine: number | null;
  beforeLine: number | null;
  kind: "ADDED" | "REMOVED" | "UNCHANGED";
  value: string;
};

export type MarkdownCheckpointRetentionRecord = {
  createdAt: Date;
  id: string;
  reason: MarkdownCheckpointReason;
  sequence: number;
};

export type MarkdownTemplate = {
  description: string;
  id: "software-project" | "technology-supply";
  label: string;
  sourceMarkdown: string;
};

const templates: MarkdownTemplate[] = [
  {
    description: "Diagnóstico, solución, alcance, inversión y condiciones para software.",
    id: "software-project",
    label: "PROYECTO DE SOFTWARE",
    sourceMarkdown: [
      "---",
      "template: software-project",
      "language: es",
      "---",
      "",
      "# {{proposal.title}}",
      "",
      "## Contexto {#context type=CONTEXT}",
      "",
      "Preparado para {{client.companyName}}.",
      "",
      "## Solución propuesta {#solution type=SOLUTION}",
      "",
      "Describe la operación que esta propuesta hará más clara, segura o eficiente.",
      "",
      "## Alcance {#scope type=SCOPE}",
      "",
      "- Descubrimiento y definición técnica",
      "- Implementación verificable",
      "- Entrega y acompañamiento inicial",
      "",
      "## Inversión {#investment type=INVESTMENT}",
      "",
      "{{proposal.totals}}",
      "",
      "## Condiciones {#conditions type=CONDITIONS}",
      "",
      "Vigencia: {{proposal.validUntil}}.",
      ""
    ].join("\n")
  },
  {
    description: "Especificación, suministro, entrega y condiciones para tecnología.",
    id: "technology-supply",
    label: "SUMINISTRO TECNOLÓGICO",
    sourceMarkdown: [
      "---",
      "template: technology-supply",
      "language: es",
      "---",
      "",
      "# {{proposal.title}}",
      "",
      "## Requerimiento {#context type=CONTEXT}",
      "",
      "Preparado para {{client.companyName}}.",
      "",
      "## Especificación {#specification type=SOLUTION}",
      "",
      "Define los equipos, compatibilidades y criterios de aceptación.",
      "",
      "## Suministro {#supply type=DELIVERABLES}",
      "",
      "{{proposal.lineItems}}",
      "",
      "## Entrega {#timeline type=TIMELINE}",
      "",
      "{{proposal.timeline}}",
      "",
      "## Condiciones {#conditions type=CONDITIONS}",
      "",
      "Vigencia: {{proposal.validUntil}}.",
      ""
    ].join("\n")
  }
];

export const markdownTemplates = Object.freeze(templates);

export function getMarkdownTemplate(templateId: string): MarkdownTemplate | null {
  return markdownTemplates.find((template) => template.id === templateId) ?? null;
}

/**
 * A compact, deterministic LCS line diff. It deliberately operates on source
 * text only; neither MDAST nor HTML is ever used as a history representation.
 */
export function diffMarkdownSources(before: string, after: string): MarkdownLineDiff[] {
  const beforeLines = before.split(/\r\n|\r|\n/u);
  const afterLines = after.split(/\r\n|\r|\n/u);
  const matrix = Array.from({ length: beforeLines.length + 1 }, () =>
    new Uint32Array(afterLines.length + 1)
  );

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      matrix[beforeIndex][afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? matrix[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(matrix[beforeIndex + 1][afterIndex], matrix[beforeIndex][afterIndex + 1]);
    }
  }

  const result: MarkdownLineDiff[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
    if (
      beforeIndex < beforeLines.length &&
      afterIndex < afterLines.length &&
      beforeLines[beforeIndex] === afterLines[afterIndex]
    ) {
      result.push({
        afterLine: afterIndex + 1,
        beforeLine: beforeIndex + 1,
        kind: "UNCHANGED",
        value: beforeLines[beforeIndex]
      });
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      afterIndex < afterLines.length &&
      (beforeIndex === beforeLines.length ||
        matrix[beforeIndex][afterIndex + 1] >= matrix[beforeIndex + 1][afterIndex])
    ) {
      result.push({
        afterLine: afterIndex + 1,
        beforeLine: null,
        kind: "ADDED",
        value: afterLines[afterIndex]
      });
      afterIndex += 1;
    } else {
      result.push({
        afterLine: null,
        beforeLine: beforeIndex + 1,
        kind: "REMOVED",
        value: beforeLines[beforeIndex]
      });
      beforeIndex += 1;
    }
  }
  return result;
}

export function checkpointRetentionPlan(
  checkpoints: MarkdownCheckpointRetentionRecord[],
  automaticLimit = 20
) {
  const retained = new Set<string>();
  const ordered = [...checkpoints].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() || right.sequence - left.sequence
  );
  const permanentReasons = new Set<MarkdownCheckpointReason>([
    "IMPORT",
    "PRE_SHARE",
    "RESTORE",
    "REVISION_CLONED"
  ]);
  for (const checkpoint of ordered) {
    if (permanentReasons.has(checkpoint.reason)) {
      retained.add(checkpoint.id);
    }
  }
  const latestManual = ordered.find((checkpoint) => checkpoint.reason === "MANUAL_SAVE");
  if (latestManual) {
    retained.add(latestManual.id);
  }
  const automatic = ordered.filter((checkpoint) =>
    ["MANUAL_SAVE", "REIMPORT_REPLACE", "REIMPORT_MERGE", "APPEND", "TEMPLATE_APPLIED"].includes(
      checkpoint.reason
    )
  );
  for (const checkpoint of automatic.slice(0, automaticLimit)) {
    retained.add(checkpoint.id);
  }
  return {
    deleteIds: ordered.filter((checkpoint) => !retained.has(checkpoint.id)).map((item) => item.id),
    retainedIds: [...retained]
  };
}

export function describeCheckpoint(checkpoint: {
  reason: MarkdownCheckpointReason;
  sourceHash: string;
}) {
  return `${checkpoint.reason} / ${checkpoint.sourceHash.slice(0, 10)}`;
}

export function templateSourceHash(templateId: string) {
  const template = getMarkdownTemplate(templateId);
  return template ? hashMarkdownSource(template.sourceMarkdown) : null;
}
