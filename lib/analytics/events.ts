import { createHmac } from "node:crypto";

import { z } from "zod";

const eventTypes = ["PAGE_VIEW", "CTA_CLICK", "OUTBOUND_CLICK"] as const;
const themes = ["neutral", "night"] as const;
const viewports = ["mobile", "tablet", "desktop"] as const;

const publicPath = z
  .string()
  .trim()
  .regex(/^\/[a-z0-9/_-]*$/i)
  .max(240)
  .refine(
    (path) =>
      !path.startsWith("/admin") && !path.startsWith("/api") && !path.startsWith("/propuesta"),
    "Only public marketing paths can be measured."
  );

export const webAnalyticsEventSchema = z.object({
  eventType: z.enum(eventTypes),
  path: publicPath,
  referrerOrigin: z.string().url().max(255).optional().nullable(),
  sessionId: z.string().regex(/^[a-f0-9]{32}$/).max(32),
  target: z.string().trim().regex(/^[A-Z0-9_:-]+$/).max(160).optional().nullable(),
  theme: z.enum(themes).optional().nullable(),
  viewport: z.enum(viewports).optional().nullable()
});

export type WebAnalyticsEventInput = z.infer<typeof webAnalyticsEventSchema>;

export function normalizeReferrerOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function hashAnalyticsSession(sessionId: string) {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "janvier-analytics-local-only")
    .update(sessionId)
    .digest("hex");
}

export function isPublicAnalyticsPath(path: string) {
  return publicPath.safeParse(path).success;
}
