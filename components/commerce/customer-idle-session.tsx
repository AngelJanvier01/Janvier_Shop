"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const idleTimeoutMs = 60 * 60 * 1000;
const checkIntervalMs = 15 * 1000;
const serverTouchIntervalMs = 4 * 60 * 1000;

export function CustomerIdleSession() {
  const router = useRouter();

  useEffect(() => {
    let lastActivityAt = Date.now();
    let lastServerTouchAt = Date.now();
    let signingOut = false;
    const goToLogin = () => {
      router.replace("/suministro/acceso?expired=inactive");
      router.refresh();
    };

    const recordActivity = () => {
      const now = Date.now();
      lastActivityAt = now;
      if (now - lastServerTouchAt < serverTouchIntervalMs) return;
      lastServerTouchAt = now;
      void fetch("/api/customer/auth/activity", {
        method: "POST",
        keepalive: true
      })
        .then((response) => {
          if (response.status === 401) {
            goToLogin();
          }
        })
        .catch(() => null);
    };
    const signOutIfIdle = async () => {
      if (signingOut || Date.now() - lastActivityAt < idleTimeoutMs) return;
      signingOut = true;
      await fetch("/api/customer/auth/logout", {
        method: "POST",
        keepalive: true
      }).catch(() => null);
      goToLogin();
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      "keydown",
      "pointerdown",
      "scroll",
      "touchstart"
    ];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true })
    );
    const interval = window.setInterval(signOutIfIdle, checkIntervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void signOutIfIdle();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, recordActivity)
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
