import { describe, expect, it } from "vitest";

import {
  checkpointRetentionPlan,
  diffMarkdownSources,
  getMarkdownTemplate,
  type MarkdownCheckpointRetentionRecord
} from "../../lib/proposals/markdown/history";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

describe("Markdown history", () => {
  it("genera un diff de líneas estable sin interpretar Markdown ni HTML", () => {
    expect(diffMarkdownSources("# Uno\n\nTexto", "# Uno\n\nTexto nuevo")).toEqual([
      { afterLine: 1, beforeLine: 1, kind: "UNCHANGED", value: "# Uno" },
      { afterLine: 2, beforeLine: 2, kind: "UNCHANGED", value: "" },
      { afterLine: 3, beforeLine: null, kind: "ADDED", value: "Texto nuevo" },
      { afterLine: null, beforeLine: 3, kind: "REMOVED", value: "Texto" }
    ]);
  });

  it("retiene evidencia y limita checkpoints automáticos sin borrar el último manual", () => {
    const checkpoints: MarkdownCheckpointRetentionRecord[] = Array.from(
      { length: 25 },
      (_, index) => ({
        createdAt: new Date(2026, 0, index + 1),
        id: `auto-${index + 1}`,
        reason: "MANUAL_SAVE" as const,
        sequence: index + 1
      })
    );
    checkpoints.push({
      createdAt: new Date(2025, 0, 1),
      id: "import",
      reason: "IMPORT",
      sequence: 0
    });
    const plan = checkpointRetentionPlan(checkpoints);

    expect(plan.retainedIds).toContain("import");
    expect(plan.retainedIds).toContain("auto-25");
    expect(plan.deleteIds).toEqual(["auto-5", "auto-4", "auto-3", "auto-2", "auto-1"]);
  });

  it("expone sólo plantillas controladas por código", () => {
    const software = getMarkdownTemplate("software-project");
    const supply = getMarkdownTemplate("technology-supply");

    expect(software?.sourceMarkdown).toContain("{{proposal.totals}}");
    expect(parseJanvierMarkdown(software?.sourceMarkdown ?? "").status).toBe("VALID");
    expect(parseJanvierMarkdown(supply?.sourceMarkdown ?? "").status).toBe("VALID");
    expect(getMarkdownTemplate("../../not-a-template")).toBeNull();
  });
});
