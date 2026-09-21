import "dotenv/config";

import { database } from "../../lib/database";
import { defaultSicoddSyncScope, queueSicoddSync } from "../../lib/sicodd/sync";

function argumentValue(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (!process.argv.includes("--confirm")) {
  throw new Error(
    "Este comando encola una sincronización real. Vuelve a ejecutarlo con --confirm."
  );
}

const rawLimit = argumentValue("--limit");
const limit = rawLimit === undefined ? null : Number.parseInt(rawLimit, 10);
if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 20_000)) {
  throw new Error("--limit debe ser un entero entre 1 y 20000.");
}

try {
  const active = await database.sicoddSyncRun.findFirst({
    select: { id: true, sequence: true, status: true },
    where: { status: { in: ["QUEUED", "RUNNING"] } }
  });
  if (active) {
    throw new Error(
      `Ya existe la corrida ${active.sequence} con estado ${active.status}; no se encoló otra.`
    );
  }

  const owner = await database.adminUser.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { isActive: true, role: "OWNER" }
  });
  if (!owner) throw new Error("No existe un administrador OWNER activo.");

  const run = await queueSicoddSync({
    limit,
    mode: "FULL",
    requestedById: owner.id,
    scope: defaultSicoddSyncScope,
    trigger: "MANUAL"
  });
  console.info(
    JSON.stringify({
      id: run.id,
      limit: run.requestedLimit,
      sequence: run.sequence,
      status: run.status
    })
  );
} finally {
  await database.$disconnect();
}
