import { database } from "@/lib/database";
import {
  hashAnalyticsSession,
  normalizeReferrerOrigin,
  webAnalyticsEventSchema
} from "@/lib/analytics/events";
import { assertRequestRate } from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateError = assertRequestRate(request, "public", "analytics-event", 120);
  if (rateError) {
    return new Response(null, { status: 204 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(null, { status: 415 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = webAnalyticsEventSchema.safeParse(input);
  if (!parsed.success) return new Response(null, { status: 204 });

  const event = parsed.data;
  try {
    await database.webAnalyticsEvent.create({
      data: {
        eventType: event.eventType,
        path: event.path,
        referrerOrigin: normalizeReferrerOrigin(event.referrerOrigin),
        sessionHash: hashAnalyticsSession(event.sessionId),
        target: event.target ?? null,
        theme: event.theme ?? null,
        viewport: event.viewport ?? null
      }
    });
  } catch {
    // Measurement must never delay or break a visitor's navigation.
  }

  return new Response(null, { status: 204 });
}
