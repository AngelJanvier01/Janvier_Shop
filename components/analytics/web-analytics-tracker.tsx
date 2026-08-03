"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const sessionStorageKey = "janvier-analytics-session";

type AnalyticsEvent = {
  eventType: "PAGE_VIEW" | "CTA_CLICK" | "OUTBOUND_CLICK";
  path: string;
  referrerOrigin?: string | null;
  sessionId: string;
  target?: string | null;
  theme?: "neutral" | "night" | null;
  viewport?: "mobile" | "tablet" | "desktop";
};

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

function viewport() {
  if (window.innerWidth < 768) return "mobile" as const;
  if (window.innerWidth < 1100) return "tablet" as const;
  return "desktop" as const;
}

function send(event: AnalyticsEvent) {
  const body = JSON.stringify(event);
  try {
    if (
      navigator.sendBeacon?.(
        "/api/analytics/events",
        new Blob([body], { type: "application/json" })
      )
    ) {
      return;
    }
    void fetch("/api/analytics/events", {
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST"
    });
  } catch {
    // Analytics is intentionally best-effort.
  }
}

function isPublicPath(path: string) {
  return (
    !path.startsWith("/admin") &&
    !path.startsWith("/api") &&
    !path.startsWith("/propuesta")
  );
}

export function WebAnalyticsTracker() {
  const pathname = usePathname();
  const hasTrackedInitialPath = useRef(false);
  const sessionId = useRef<string | null>(null);
  const measuredPaths = useRef(new Set<string>());

  useEffect(() => {
    if (!isPublicPath(pathname) || measuredPaths.current.has(pathname)) return;
    measuredPaths.current.add(pathname);
    sessionId.current ??= getSessionId();
    const isInitialPath = !hasTrackedInitialPath.current;
    hasTrackedInitialPath.current = true;
    send({
      eventType: "PAGE_VIEW",
      path: pathname,
      referrerOrigin: isInitialPath ? document.referrer || null : null,
      sessionId: sessionId.current,
      theme: document.documentElement.dataset.theme === "night" ? "night" : "neutral",
      viewport: viewport()
    });
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isPublicPath(window.location.pathname)) return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        "[data-analytics]"
      );
      const label = target?.dataset.analytics;
      if (!target || !label) return;
      sessionId.current ??= getSessionId();
      send({
        eventType:
          target instanceof HTMLAnchorElement && target.target === "_blank"
            ? "OUTBOUND_CLICK"
            : "CTA_CLICK",
        path: window.location.pathname,
        sessionId: sessionId.current,
        target: label,
        theme: document.documentElement.dataset.theme === "night" ? "night" : "neutral",
        viewport: viewport()
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
