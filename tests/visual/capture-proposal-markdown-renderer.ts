import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import { chromium, type BrowserContextOptions } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";
import { persistMarkdownDraft } from "../../lib/proposals/markdown/drafts";
import { parseJanvierMarkdown } from "../../lib/proposals/markdown/parser";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
const outputDirectory = path.resolve("artifacts/proposal-markdown-renderer");
const runId = randomBytes(5).toString("hex");

const source = [
  "---",
  "title: Documento de evidencia",
  "subtitle: Renderer estructurado JANVIER",
  "---",
  "",
  "# Documento de evidencia",
  "",
  "## Contexto {#context type=CONTEXT}",
  "",
  "Propuesta preparada para {{client.companyName}}.",
  "",
  "| Fase | Estado |",
  "| --- | --- |",
  "| Diseño | Activo |",
  "",
  ":::janvier-callout",
  "type: signal",
  "title: Punto de control",
  "",
  "Documento seguro y reutilizable.",
  ":::",
  "",
  ":::janvier-internal",
  "Contenido interno reservado.",
  ":::",
  "",
  "## Alternativas {#alternatives type=ALTERNATIVES}",
  "",
  "{{proposal.options}}"
].join("\n");

const captures: Array<{
  name: string;
  options: BrowserContextOptions;
  theme: "neutral" | "night";
}> = [
  {
    name: "desktop-neutral",
    options: { deviceScaleFactor: 1, viewport: { height: 900, width: 1440 } },
    theme: "neutral"
  },
  {
    name: "desktop-night",
    options: { deviceScaleFactor: 1, viewport: { height: 900, width: 1440 } },
    theme: "night"
  },
  {
    name: "mobile-neutral",
    options: {
      deviceScaleFactor: 1,
      isMobile: true,
      viewport: { height: 844, width: 390 }
    },
    theme: "neutral"
  },
  {
    name: "mobile-night",
    options: {
      deviceScaleFactor: 1,
      isMobile: true,
      viewport: { height: 844, width: 390 }
    },
    theme: "night"
  }
];

async function main() {
  const owner = await database.adminUser.findFirstOrThrow({
    select: { id: true },
    where: { isActive: true }
  });
  const client = await database.client.create({
    data: {
      companyName: "Operadora Evidencia JANVIER",
      contactName: "Cliente de evidencia",
      email: `capture-${runId}@example.test`
    }
  });
  const proposal = await database.proposal.create({
    data: {
      clientId: client.id,
      ownerId: owner.id,
      reference: `CAPTURE-${runId.toUpperCase()}`,
      title: "Evidencia renderer",
      status: "DRAFT"
    }
  });
  const revision = await database.proposalRevision.create({
    data: {
      authorId: owner.id,
      proposalId: proposal.id,
      revision: 1,
      title: "Evidencia renderer"
    }
  });
  const parsed = parseJanvierMarkdown(source);
  if (parsed.status !== "VALID") {
    throw new Error("La fuente de evidencia no es válida.");
  }
  await persistMarkdownDraft(revision.id, owner.id, {
    expectedSourceHash: null,
    expectedVersion: null,
    originalFileName: "renderer-evidence.md",
    reason: "IMPORT",
    sourceHash: parsed.sourceHash,
    sourceMarkdown: source
  });

  const session = await createAdminSession(owner.id);
  const browser = await chromium.launch();
  await mkdir(outputDirectory, { recursive: true });

  try {
    for (const capture of captures) {
      const context = await browser.newContext(capture.options);
      await context.addCookies([
        {
          domain: new URL(baseUrl).hostname,
          name: adminSessionCookieName,
          path: "/",
          value: session.token
        }
      ]);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/admin/propuestas/${proposal.id}`, {
        waitUntil: "networkidle"
      });
      await page.evaluate((theme) => {
        window.localStorage.setItem("janvier-theme", theme);
        document.documentElement.dataset.theme = theme;
      }, capture.theme);
      const panel = page.getByTestId("rendered-document-panel");
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(outputDirectory, `${capture.name}.png`),
        fullPage: true
      });
      await context.close();
    }
  } finally {
    await browser.close();
    await database.proposal.delete({ where: { id: proposal.id } });
    await database.client.delete({ where: { id: client.id } });
  }

  console.log(`Renderer captures created in ${outputDirectory}`);
}

await main();
