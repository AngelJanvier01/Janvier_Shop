import { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { getEmailConfiguration } from "./config";
import { queueAdminEmail } from "./outbox";

type CalendarDay = { day: number; month: number; year: number };

function zonedDay(date: Date, timeZone: string): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { day: part("day"), month: part("month"), year: part("year") };
}

function dayKey(day: CalendarDay) {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function previousCalendarDay(day: CalendarDay): CalendarDay {
  return zonedDay(new Date(Date.UTC(day.year, day.month - 1, day.day - 1, 12)), "UTC");
}

function localMidnightAsUtc(day: CalendarDay, timeZone: string) {
  let timestamp = Date.UTC(day.year, day.month - 1, day.day, 0, 0, 0);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = zonedDay(new Date(timestamp), timeZone);
    const wantedAsUtc = Date.UTC(day.year, day.month - 1, day.day);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day);
    const dayDelta = wantedAsUtc - observedAsUtc;
    const observedTime = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      second: "2-digit",
      timeZone
    }).formatToParts(new Date(timestamp));
    const hour = Number(observedTime.find((item) => item.type === "hour")?.value ?? 0);
    const minute = Number(
      observedTime.find((item) => item.type === "minute")?.value ?? 0
    );
    const second = Number(
      observedTime.find((item) => item.type === "second")?.value ?? 0
    );
    timestamp += dayDelta - (hour * 60 * 60_000 + minute * 60_000 + second * 1_000);
  }
  return new Date(timestamp);
}

export function previousReportPeriod(date: Date, timeZone: string) {
  const day = previousCalendarDay(zonedDay(date, timeZone));
  const nextDay = zonedDay(
    new Date(Date.UTC(day.year, day.month - 1, day.day + 1, 12)),
    "UTC"
  );
  return {
    dayKey: dayKey(day),
    since: localMidnightAsUtc(day, timeZone),
    until: localMidnightAsUtc(nextDay, timeZone)
  };
}

export async function queueDailyOperationsReport(date = new Date()) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !configuration.isConfigured) return { queued: 0 };

  const periodRange = previousReportPeriod(date, configuration.timeZone);
  const [diagnostics, proposals, views, visits] = await Promise.all([
    database.diagnosticRequest.count({
      where: { createdAt: { gte: periodRange.since, lt: periodRange.until } }
    }),
    database.proposal.count({
      where: { createdAt: { gte: periodRange.since, lt: periodRange.until } }
    }),
    database.proposalEvent.count({
      where: {
        createdAt: { gte: periodRange.since, lt: periodRange.until },
        type: "INVITE_VIEWED"
      }
    }),
    database.webAnalyticsEvent.count({
      where: { createdAt: { gte: periodRange.since, lt: periodRange.until } }
    })
  ]);
  const period = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: configuration.timeZone
  }).format(periodRange.since);
  return queueAdminEmail({
    actionLabel: "Abrir panel privado",
    actionUrl: `${configuration.appUrl}/admin`,
    dedupeKey: `daily-report:${configuration.timeZone}:${periodRange.dayKey}`,
    details: [
      { label: "Fecha", value: periodRange.dayKey },
      { label: "Zona horaria", value: configuration.timeZone },
      { label: "Solicitudes recibidas", value: String(diagnostics) },
      { label: "Propuestas creadas", value: String(proposals) },
      { label: "Propuestas vistas", value: String(views) },
      { label: "Eventos analiticos", value: String(visits) }
    ],
    kind: EmailNotificationKind.DAILY_REPORT,
    priority: 5,
    subject: `JANVIER · Resumen operativo · ${period}`,
    summary: "Resumen automatico de la actividad registrada durante el dia anterior.",
    title: "Resumen operativo diario",
    tone: "signal"
  });
}
