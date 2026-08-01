"use client";

import { useSyncExternalStore } from "react";

import styles from "./theme-toggle.module.css";

type Theme = "neutral" | "night";

const storageKey = "janvier-theme";
const themeChangeEvent = "janvier-theme-change";

function getDocumentTheme(): Theme {
  return document.documentElement.dataset.theme === "night" ? "night" : "neutral";
}

function readTheme(): Theme {
  return getDocumentTheme();
}

function subscribe(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === storageKey) {
      callback();
    }
  }

  window.addEventListener(themeChangeEvent, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(themeChangeEvent, callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): Theme {
  return "neutral";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  function toggleTheme() {
    const currentTheme = getDocumentTheme();
    const nextTheme: Theme = currentTheme === "neutral" ? "night" : "neutral";
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // The DOM attribute still provides a usable session-only theme.
    }
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const isNight = theme === "night";

  return (
    <button
      aria-label={isNight ? "Activar tema neutral" : "Activar tema night"}
      aria-pressed={isNight}
      className={styles.toggle}
      data-testid="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true">{isNight ? "◐" : "◒"}</span>
      <span className="srOnly">
        {isNight ? "Tema night activo" : "Tema neutral activo"}
      </span>
    </button>
  );
}
