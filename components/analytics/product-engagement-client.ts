"use client";

const sessionStorageKey = "janvier-analytics-session";

export type ProductEngagementEventType =
  "PRODUCT_VIEW" | "GALLERY_COMPLETED" | "TECHNICAL_SHEET_VIEW";

function createSessionId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function getSessionId() {
  try {
    const stored = window.sessionStorage.getItem(sessionStorageKey);
    if (stored && /^[a-f0-9]{32}$/.test(stored)) return stored;
    const next = createSessionId();
    window.sessionStorage.setItem(sessionStorageKey, next);
    return next;
  } catch {
    return createSessionId();
  }
}

export function sendProductEngagement(input: {
  eventType: ProductEngagementEventType;
  galleryImageCount?: number;
  productId: string;
}) {
  const body = JSON.stringify({ ...input, sessionId: getSessionId() });
  try {
    if (
      navigator.sendBeacon?.(
        "/api/analytics/product-engagement",
        new Blob([body], { type: "application/json" })
      )
    ) {
      return;
    }
    void fetch("/api/analytics/product-engagement", {
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST"
    });
  } catch {
    // This is intentionally best-effort and must never affect the catalog.
  }
}

export function markProductViewMeasured(productId: string) {
  try {
    const key = `janvier-product-view:${productId}`;
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}
