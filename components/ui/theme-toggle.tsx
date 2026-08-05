"use client";

import { useSyncExternalStore } from "react";

import {
  getDocumentTheme,
  getServerTheme,
  setDocumentTheme,
  subscribeToTheme,
  type Theme
} from "./theme-preference";
import styles from "./theme-toggle.module.css";

function readTheme(): Theme {
  return getDocumentTheme();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, getServerTheme);

  function toggleTheme() {
    const currentTheme = getDocumentTheme();
    const nextTheme: Theme = currentTheme === "neutral" ? "night" : "neutral";
    setDocumentTheme(nextTheme);
  }

  const isNight = theme === "night";

  return (
    <button
      aria-label={isNight ? "Activar modo claro" : "Activar modo oscuro"}
      aria-pressed={isNight}
      className={styles.toggle}
      data-testid="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span aria-hidden="true">{isNight ? "◐" : "◒"}</span>
      <span className="srOnly">
        {isNight ? "Modo oscuro activo" : "Modo claro activo"}
      </span>
    </button>
  );
}
