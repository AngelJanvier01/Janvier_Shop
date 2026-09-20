import { createHmac } from "node:crypto";

import { z } from "zod";

const productEngagementTypes = [
  "PRODUCT_VIEW",
  "GALLERY_COMPLETED",
  "TECHNICAL_SHEET_VIEW"
] as const;

export const productEngagementEventSchema = z.object({
  eventType: z.enum(productEngagementTypes),
  galleryImageCount: z.coerce.number().int().min(2).max(24).optional().nullable(),
  productId: z.string().cuid(),
  sessionId: z.string().regex(/^[a-f0-9]{32}$/).max(32)
});

export type ProductEngagementEventInput = z.infer<typeof productEngagementEventSchema>;

/**
 * This value is only useful for short-lived aggregate measurement. It never
 * stores the browser identifier itself, an IP address, or a user agent.
 */
export function hashProductEngagementSession(sessionId: string) {
  return createHmac(
    "sha256",
    process.env.AUTH_SECRET ?? "janvier-product-engagement-local-only"
  )
    .update(`product-engagement:${sessionId}`)
    .digest("hex");
}

export function hashCustomerEngagementActor(customerUserId: string) {
  return createHmac(
    "sha256",
    process.env.AUTH_SECRET ?? "janvier-product-engagement-local-only"
  )
    .update(`product-engagement-customer:${customerUserId}`)
    .digest("hex");
}
