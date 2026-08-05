export type Theme = "neutral" | "night";

export const themeStorageKey = "janvier-theme";
export const themeChangeEvent = "janvier-theme-change";

export function getDocumentTheme(): Theme {
  return document.documentElement.dataset.theme === "night" ? "night" : "neutral";
}

export function setDocumentTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The DOM attribute still provides a usable session-only theme.
  }
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function subscribeToTheme(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === themeStorageKey) {
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

export function getServerTheme(): Theme {
  return "neutral";
}
