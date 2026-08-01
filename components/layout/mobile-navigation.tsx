"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

import { primaryNavigation } from "./navigation";
import styles from "./site-header.module.css";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className={styles.mobileNav} data-testid="mobile-navigation">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={styles.menuButton}
        data-testid="mobile-menu-toggle"
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        type="button"
      >
        <span>{isOpen ? "Cerrar" : "Menú"}</span>
        <span aria-hidden="true">{isOpen ? "×" : "+"}</span>
      </button>
      {isOpen ? (
        <div className={styles.mobilePanel} id={panelId}>
          <nav aria-label="Navegación principal móvil">
            {primaryNavigation.map((item) => (
              <Link href={item.href} key={item.href} onClick={closeMenu}>
                {item.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      ) : null}
    </div>
  );
}
