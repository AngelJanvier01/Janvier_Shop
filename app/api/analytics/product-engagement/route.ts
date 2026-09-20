import {
  productEngagementEventSchema,
  hashProductEngagementSession
} from "@/lib/analytics/product-engagement";
import { getCurrentCustomer } from "@/lib/auth/current-customer";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = assertSameOriginMutation(request);
  if (originError) return originError;
  const rateError = await assertRequestRate(request, "public", "product-engagement", 90);
  if (rateError) return new Response(null, { status: 204 });
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return new Response(null, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = productEngagementEventSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 204 });

  const [product, customer] = await Promise.all([
    database.product.findFirst({
      select: { id: true },
      where: { id: parsed.data.productId, status: "PUBLISHED" }
    }),
    getCurrentCustomer()
  ]);
  if (!product) return new Response(null, { status: 204 });

  try {
    await database.productEngagementEvent.create({
      data: {
        accountId: customer?.accountId ?? null,
        customerUserId: customer?.id ?? null,
        eventType: parsed.data.eventType,
        galleryImageCount:
          parsed.data.eventType === "GALLERY_COMPLETED"
            ? (parsed.data.galleryImageCount ?? null)
            : null,
        productId: product.id,
        sessionHash: hashProductEngagementSession(parsed.data.sessionId)
      }
    });
  } catch (error) {
    // Measurement must never delay or break a catalog interaction.
    console.error("Product engagement measurement failed", error);
  }
  return new Response(null, { status: 204 });
}
