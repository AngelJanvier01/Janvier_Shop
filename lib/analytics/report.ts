import { database } from "@/lib/database";

function countBy(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 8);
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getWebAnalyticsReport(days = 30) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [events, diagnosticConversions] = await Promise.all([
    database.webAnalyticsEvent.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        eventType: true,
        path: true,
        referrerOrigin: true,
        sessionHash: true,
        target: true
      },
      take: 50_000,
      where: { createdAt: { gte: since } }
    }),
    database.diagnosticRequest.count({ where: { createdAt: { gte: sevenDaysAgo } } })
  ]);
  const sevenDayEvents = events.filter((event) => event.createdAt >= sevenDaysAgo);
  const views = sevenDayEvents.filter((event) => event.eventType === "PAGE_VIEW");
  const callsToAction = sevenDayEvents.filter((event) => event.eventType !== "PAGE_VIEW");
  const sessions = new Set(views.map((event) => event.sessionHash));
  const daily = new Map<string, { callsToAction: number; sessions: Set<string>; views: number }>();

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - offset);
    daily.set(dayKey(date), { callsToAction: 0, sessions: new Set(), views: 0 });
  }
  for (const event of events) {
    const bucket = daily.get(dayKey(event.createdAt));
    if (!bucket) continue;
    if (event.eventType === "PAGE_VIEW") {
      bucket.views += 1;
      bucket.sessions.add(event.sessionHash);
    } else {
      bucket.callsToAction += 1;
    }
  }

  return {
    callsToAction: callsToAction.length,
    conversionRate:
      sessions.size > 0 ? Math.round((diagnosticConversions / sessions.size) * 10_000) / 100 : 0,
    daily: [...daily.entries()].map(([date, value]) => ({
      callsToAction: value.callsToAction,
      date,
      sessions: value.sessions.size,
      views: value.views
    })),
    diagnosticConversions,
    limitReached: events.length === 50_000,
    topCtas: countBy(callsToAction.map((event) => event.target)),
    topPages: countBy(views.map((event) => event.path)),
    topSources: countBy(views.map((event) => event.referrerOrigin)),
    uniqueSessions: sessions.size,
    views: views.length
  };
}
