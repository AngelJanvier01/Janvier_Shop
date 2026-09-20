import { database } from "@/lib/database";

const eventTypes = [
  "PRODUCT_VIEW",
  "GALLERY_COMPLETED",
  "TECHNICAL_SHEET_VIEW",
  "CART_ADDED"
] as const;

type EventType = (typeof eventTypes)[number];

function createdAfter(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function eventTotals(rows: Array<{ eventType: EventType; count: number }>) {
  const totals = new Map<EventType, number>(eventTypes.map((type) => [type, 0]));
  for (const row of rows) {
    totals.set(row.eventType, (totals.get(row.eventType) ?? 0) + row.count);
  }
  return totals;
}

export async function getProductEngagementReport(input?: {
  days?: number;
  productId?: string;
}) {
  const days = Math.min(Math.max(input?.days ?? 30, 1), 90);
  const since = createdAfter(days);
  const groupedPromise = database.productEngagementEvent.groupBy({
    _count: { _all: true },
    by: ["productId", "eventType"],
    where: { createdAt: { gte: since } }
  });
  const detailPromise = input?.productId
    ? getProductEngagementDetail(input.productId, since)
    : Promise.resolve(null);
  const grouped = await groupedPromise;
  const rows = grouped.map((row) => ({
    count: row._count._all,
    eventType: row.eventType as EventType,
    productId: row.productId
  }));
  const productIds = [...new Set(rows.map((row) => row.productId))];
  const products = productIds.length
    ? await database.product.findMany({
        select: { brand: true, id: true, name: true, sku: true, status: true },
        where: { id: { in: productIds } }
      })
    : [];
  const productsById = new Map(products.map((product) => [product.id, product]));
  const byProduct = new Map<string, Array<{ eventType: EventType; count: number }>>();
  for (const row of rows) {
    const current = byProduct.get(row.productId) ?? [];
    current.push({ count: row.count, eventType: row.eventType });
    byProduct.set(row.productId, current);
  }

  const leaderboard = [...byProduct.entries()]
    .flatMap(([productId, productRows]) => {
      const product = productsById.get(productId);
      if (!product) return [];
      const totals = eventTotals(productRows);
      const views = totals.get("PRODUCT_VIEW") ?? 0;
      return [
        {
          brand: product.brand,
          cartAdds: totals.get("CART_ADDED") ?? 0,
          galleryCompletions: totals.get("GALLERY_COMPLETED") ?? 0,
          galleryRate: percentage(totals.get("GALLERY_COMPLETED") ?? 0, views),
          id: product.id,
          name: product.name,
          sheetViews: totals.get("TECHNICAL_SHEET_VIEW") ?? 0,
          sku: product.sku,
          status: product.status,
          views
        }
      ];
    })
    .sort(
      (left, right) =>
        right.views - left.views ||
        right.cartAdds - left.cartAdds ||
        left.name.localeCompare(right.name, "es-MX")
    )
    .slice(0, 12);
  const overall = eventTotals(
    rows.map((row) => ({ count: row.count, eventType: row.eventType }))
  );
  const detail = await detailPromise;

  return {
    days,
    detail,
    leaderboard,
    metrics: {
      cartAdds: overall.get("CART_ADDED") ?? 0,
      galleryCompletions: overall.get("GALLERY_COMPLETED") ?? 0,
      productViews: overall.get("PRODUCT_VIEW") ?? 0,
      sheetViews: overall.get("TECHNICAL_SHEET_VIEW") ?? 0
    }
  };
}

async function getProductEngagementDetail(productId: string, since: Date) {
  const eventLimit = 25_000;
  const [product, events, knownEvents] = await Promise.all([
    database.product.findUnique({
      select: { brand: true, id: true, name: true, sku: true, status: true },
      where: { id: productId }
    }),
    database.productEngagementEvent.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        createdAt: true,
        eventType: true,
        sessionHash: true
      },
      take: eventLimit,
      where: { createdAt: { gte: since }, productId }
    }),
    database.productEngagementEvent.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        createdAt: true,
        customerUser: {
          select: {
            account: { select: { companyName: true } },
            email: true,
            id: true,
            name: true
          }
        },
        eventType: true
      },
      take: 250,
      where: {
        createdAt: { gte: since },
        customerUserId: { not: null },
        productId
      }
    })
  ]);
  if (!product) return null;

  const totals = eventTotals(
    events.map((event) => ({ count: 1, eventType: event.eventType as EventType }))
  );
  const uniqueViewSessions = new Set(
    events
      .filter((event) => event.eventType === "PRODUCT_VIEW" && event.sessionHash)
      .map((event) => event.sessionHash)
  ).size;
  const viewers = new Map<
    string,
    { companyName: string; email: string; eventType: EventType; name: string; viewedAt: Date }
  >();
  for (const event of knownEvents) {
    if (!event.customerUser || viewers.has(event.customerUser.id)) continue;
    viewers.set(event.customerUser.id, {
      companyName: event.customerUser.account.companyName,
      email: event.customerUser.email,
      eventType: event.eventType as EventType,
      name: event.customerUser.name,
      viewedAt: event.createdAt
    });
  }

  return {
    cartAdds: totals.get("CART_ADDED") ?? 0,
    eventReadLimitReached: events.length === eventLimit,
    galleryCompletions: totals.get("GALLERY_COMPLETED") ?? 0,
    galleryRate: percentage(totals.get("GALLERY_COMPLETED") ?? 0, uniqueViewSessions),
    product,
    sheetViews: totals.get("TECHNICAL_SHEET_VIEW") ?? 0,
    uniqueViewSessions,
    viewers: [...viewers.values()].slice(0, 12),
    views: totals.get("PRODUCT_VIEW") ?? 0
  };
}
