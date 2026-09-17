import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { EmailNotificationKind } from "../../app/generated/prisma/client";
import { createJanvierEmail, sanitizeEmailSubject } from "../../lib/notifications/templates";

const output = process.argv.find((argument) => argument.startsWith("--output="))?.slice(9);
const examples = Object.values(EmailNotificationKind).map((kind) => ({
  eyebrow: kind.replaceAll("_", " / "),
  kind,
  title: `Ejemplo ${kind.replaceAll("_", " ")}`
}));
const rendered = examples.map((example) => ({
  ...example,
  subject: sanitizeEmailSubject(`JANVIER · ${example.title}`),
  ...createJanvierEmail({
    actionLabel: "Abrir JANVIER",
    actionUrl: "https://preview.invalid/admin",
    details: [
      { label: "Evento", value: example.kind },
      { label: "Identificador", value: "PREVIEW-ONLY" }
    ],
    eyebrow: example.eyebrow,
    summary: "Vista previa local: no se conecta a SMTP ni encola mensajes.",
    title: example.title,
    tone: example.kind.includes("PASSWORD") ? "alert" : "signal"
  })
}));

const content = JSON.stringify(rendered, null, 2);
if (output) {
  await writeFile(resolve(output), content, "utf8");
  console.log(JSON.stringify({ output: resolve(output), templates: rendered.length }));
} else {
  console.log(content);
}
