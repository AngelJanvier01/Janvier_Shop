import "dotenv/config";

import { EmailNotificationKind } from "../../app/generated/prisma/client";
import { database } from "../../lib/database";
import { assertEmailConfiguration } from "../../lib/notifications/config";
import { dispatchPendingEmails } from "../../lib/notifications/dispatch";
import { queueAdminEmail } from "../../lib/notifications/outbox";

async function main() {
  assertEmailConfiguration();
  const queued = await queueAdminEmail({
    dedupeKey: `smtp-test:${Date.now()}`,
    details: [
      { label: "Entorno", value: process.env.NODE_ENV ?? "desconocido" },
      { label: "Servidor", value: process.env.NEXT_PUBLIC_SITE_URL ?? "sin URL configurada" }
    ],
    kind: EmailNotificationKind.TEST,
    subject: "JANVIER · Prueba de correo transaccional",
    summary: "La cola y el transporte SMTP pudieron preparar este mensaje de prueba.",
    title: "Correo listo",
    tone: "signal"
  });
  const delivery = await dispatchPendingEmails();
  console.log(JSON.stringify({ ...delivery, ...queued }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
