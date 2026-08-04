import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { queueAdminEmail } from "./outbox";

export async function queueDailyOperationsReport(date = new Date()) {
  const since = new Date(date);
  since.setDate(since.getDate() - 1);
  since.setHours(0, 0, 0, 0);
  const until = new Date(since);
  until.setDate(until.getDate() + 1);
  const [diagnostics, proposals, views, visits] = await Promise.all([
    database.diagnosticRequest.count({ where: { createdAt: { gte: since, lt: until } } }),
    database.proposal.count({ where: { createdAt: { gte: since, lt: until } } }),
    database.proposalEvent.count({
      where: { createdAt: { gte: since, lt: until }, type: "INVITE_VIEWED" }
    }),
    database.webAnalyticsEvent.count({ where: { createdAt: { gte: since, lt: until } } })
  ]);
  const period = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(since);
  return queueAdminEmail({
    dedupeKey: `daily-report:${since.toISOString().slice(0, 10)}`,
    details: [
      { label: "Solicitudes recibidas", value: String(diagnostics) },
      { label: "Propuestas creadas", value: String(proposals) },
      { label: "Propuestas vistas", value: String(views) },
      { label: "Eventos analíticos", value: String(visits) }
    ],
    kind: EmailNotificationKind.DAILY_REPORT,
    subject: `JANVIER · Resumen operativo · ${period}`,
    summary: "Resumen automático de la actividad registrada durante el día anterior.",
    title: "Resumen operativo diario",
    tone: "signal"
  });
}
