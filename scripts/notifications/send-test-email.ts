import "dotenv/config";

import { randomUUID } from "node:crypto";

import { EmailNotificationKind } from "../../app/generated/prisma/client";
import { database } from "../../lib/database";
import { assertEmailConfiguration } from "../../lib/notifications/config";
import { dispatchPendingEmails } from "../../lib/notifications/dispatch";
import { queueAdminEmail } from "../../lib/notifications/outbox";

async function main() {
  const configuration = assertEmailConfiguration();
  const dedupeKey = `smtp-test:${randomUUID()}`;
  console.log(
    JSON.stringify({ eventType: "TEST", recipientCount: configuration.alertRecipients.length, stage: "queue" })
  );
  const queued = await queueAdminEmail({
    actionLabel: "Abrir JANVIER",
    actionUrl: configuration.appUrl,
    dedupeKey,
    details: [
      { label: "Evento", value: "TEST" },
      { label: "Entorno", value: process.env.NODE_ENV ?? "desconocido" },
      { label: "Servidor", value: configuration.appUrl }
    ],
    kind: EmailNotificationKind.TEST,
    priority: 100,
    subject: "JANVIER · Prueba de correo transaccional",
    summary: "Este mensaje confirma la cola y el transporte SMTP; no representa actividad comercial.",
    title: "Correo de prueba",
    tone: "signal"
  });
  const delivery = await dispatchPendingEmails(configuration.alertRecipients.length, dedupeKey);
  if (delivery.failed || delivery.sent !== queued.queued) {
    throw new Error("La prueba SMTP no confirmo todos los mensajes encolados.");
  }
  console.log(JSON.stringify({ ...delivery, eventType: "TEST", queued: queued.queued, stage: "complete" }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "La prueba SMTP fallo.");
    process.exitCode = 1;
  })
  .finally(async () => database.$disconnect());
