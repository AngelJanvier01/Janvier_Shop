"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function elementFor(target: EventTarget | Node | null) {
  if (target instanceof Element) {
    return target;
  }
  return target instanceof Node ? target.parentElement : null;
}

function isEditable(target: EventTarget | Node | null) {
  return Boolean(
    elementFor(target)?.closest(
      "input, textarea, select, [contenteditable='true'], [data-copy-allowed]"
    )
  );
}

function isProtectedTarget(target: EventTarget | Node | null) {
  const element = elementFor(target);
  return Boolean(
    element?.closest("main[data-content-protected]") &&
    !element.closest("[data-copy-allowed]")
  );
}

function hasProtectedSelection() {
  const selection = window.getSelection();
  return Boolean(
    selection &&
    !selection.isCollapsed &&
    (isProtectedTarget(selection.anchorNode) || isProtectedTarget(selection.focusNode))
  );
}

/**
 * This only deters casual copying. Public content must reach the browser, so
 * determined visitors can still use developer tools, screenshots or OCR.
 */
export function ContentProtection() {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdminRoute) {
      return;
    }

    const roots = Array.from(document.querySelectorAll<HTMLElement>("main"));
    roots.forEach((root) => root.setAttribute("data-content-protected", "true"));

    function blockContextMenu(event: MouseEvent) {
      if (isProtectedTarget(event.target) && !isEditable(event.target)) {
        event.preventDefault();
      }
    }

    function blockDrag(event: DragEvent) {
      if (isProtectedTarget(event.target) && !isEditable(event.target)) {
        event.preventDefault();
      }
    }

    function blockSelection(event: Event) {
      if (isProtectedTarget(event.target) && !isEditable(event.target)) {
        event.preventDefault();
      }
    }

    function blockCopy(event: ClipboardEvent) {
      if (hasProtectedSelection() && !isEditable(event.target)) {
        event.preventDefault();
      }
    }

    function blockKeyboardShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || isEditable(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if ((key === "c" && hasProtectedSelection()) || key === "s" || key === "u") {
        event.preventDefault();
      }
    }

    document.addEventListener("contextmenu", blockContextMenu, true);
    document.addEventListener("copy", blockCopy, true);
    document.addEventListener("dragstart", blockDrag, true);
    document.addEventListener("keydown", blockKeyboardShortcut, true);
    document.addEventListener("selectstart", blockSelection, true);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu, true);
      document.removeEventListener("copy", blockCopy, true);
      document.removeEventListener("dragstart", blockDrag, true);
      document.removeEventListener("keydown", blockKeyboardShortcut, true);
      document.removeEventListener("selectstart", blockSelection, true);
      roots.forEach((root) => root.removeAttribute("data-content-protected"));
    };
  }, [isAdminRoute]);

  return null;
}
