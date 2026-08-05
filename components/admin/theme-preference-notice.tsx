"use client";

import { useSyncExternalStore } from "react";

import { setDocumentTheme, type Theme } from "@/components/ui/theme-preference";

import styles from "./theme-preference-notice.module.css";

const dismissedKey = "janvier-admin-theme-notice-dismissed";
const noticeChangeEvent = "janvier-admin-theme-notice-change";
let isDismissedInMemory = false;

function subscribeToNotice(callback: () => void) {
  window.addEventListener(noticeChangeEvent, callback);
  return () => window.removeEventListener(noticeChangeEvent, callback);
}

function readNoticeVisibility() {
  try {
    return window.sessionStorage.getItem(dismissedKey) !== "true";
  } catch {
    return !isDismissedInMemory;
  }
}

function getServerNoticeVisibility() {
  return false;
}

export function ThemePreferenceNotice() {
  const isVisible = useSyncExternalStore(
    subscribeToNotice,
    readNoticeVisibility,
    getServerNoticeVisibility
  );

  function dismiss() {
    isDismissedInMemory = true;
    try {
      window.sessionStorage.setItem(dismissedKey, "true");
    } catch {
      // The notice can still be dismissed for this browser session.
    }
    window.dispatchEvent(new Event(noticeChangeEvent));
  }

  function chooseTheme(theme: Theme) {
    setDocumentTheme(theme);
    dismiss();
  }

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Preferencia de apariencia"
      className={styles.notice}
      data-testid="admin-theme-preference-notice"
    >
      <div className={styles.copy}>
        <strong>PERSONALIZA TU VISTA</strong>
        <p>Elige modo claro u oscuro para trabajar con mayor comodidad.</p>
      </div>
      <div className={styles.actions}>
        <button onClick={() => chooseTheme("neutral")} type="button">
          MODO CLARO
        </button>
        <button onClick={() => chooseTheme("night")} type="button">
          MODO OSCURO
        </button>
      </div>
      <button
        aria-label="Cerrar aviso de apariencia"
        className={styles.dismiss}
        onClick={dismiss}
        type="button"
      >
        AHORA NO
      </button>
    </aside>
  );
}
