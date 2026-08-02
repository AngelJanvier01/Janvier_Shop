import "dotenv/config";

import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { database } from "../../lib/database";
import { getProposalAssetConfig } from "../../lib/proposals/assets";

const outputIndex = process.argv.indexOf("--output");
const outputValue = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
if (!outputValue) {
  throw new Error("Uso: npm run proposals:backup-assets -- --output <directorio-privado-de-respaldo>");
}
const output = path.resolve(outputValue);
const sourceRoot = getProposalAssetConfig().storagePath;
if (output === sourceRoot || output.startsWith(`${sourceRoot}${path.sep}`)) {
  throw new Error("El destino de respaldo debe estar fuera del almacenamiento privado activo.");
}

const blobs = await database.proposalAssetBlob.findMany({
  orderBy: { createdAt: "asc" },
  select: { mimeType: true, sha256: true, sizeBytes: true, storageKey: true }
});
await mkdir(output, { recursive: true, mode: 0o700 });
for (const blob of blobs) {
  const source = path.resolve(sourceRoot, blob.storageKey);
  const destination = path.resolve(output, blob.storageKey);
  if (!destination.startsWith(`${output}${path.sep}`)) {
    throw new Error("La clave de respaldo es invÃ¡lida.");
  }
  const bytes = await readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== blob.sha256) {
    throw new Error(`El blob ${blob.sha256.slice(0, 12)} no coincide con su hash antes del respaldo.`);
  }
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await cp(source, destination, { force: false, preserveTimestamps: true });
}
await writeFile(
  path.join(output, "proposal-assets-manifest.json"),
  `${JSON.stringify({ createdAt: new Date().toISOString(), blobs }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 }
);
console.log(`Respaldados ${blobs.length} blobs privados en ${output}.`);
await database.$disconnect();
