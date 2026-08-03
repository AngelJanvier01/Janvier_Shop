import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getProposalAssetStorage } from "../../lib/proposals/assets";

type BackupManifest = {
  blobs: Array<{ sha256: string; storageKey: string }>;
};

const inputIndex = process.argv.indexOf("--input");
const inputValue = inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined;
if (!inputValue) {
  throw new Error("Uso: npm run proposals:restore-assets -- --input <directorio-de-respaldo>");
}
const input = path.resolve(inputValue);
const manifest = JSON.parse(
  await readFile(path.join(input, "proposal-assets-manifest.json"), "utf8")
) as BackupManifest;
const storage = getProposalAssetStorage();
let restored = 0;
for (const blob of manifest.blobs) {
  const source = path.resolve(input, blob.storageKey);
  if (!source.startsWith(`${input}${path.sep}`)) {
    throw new Error("La clave del manifiesto de respaldo es inválida.");
  }
  const bytes = await readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== blob.sha256) {
    throw new Error(`El hash del respaldo no coincide para ${blob.storageKey}.`);
  }
  if (!await storage.exists(blob.storageKey)) {
    await storage.put({ bytes, storageKey: blob.storageKey });
    restored += 1;
  }
}
console.log(`Restaurados ${restored} blobs privados ausentes.`);
