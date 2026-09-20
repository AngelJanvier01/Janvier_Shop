"use client";

import { useEffect, useState } from "react";

import styles from "./cart-added-notice.module.css";

export function CartAddedNotice() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(false), 7_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <section aria-live="polite" className={styles.notice} role="status">
      <div>
        <p>PRODUCTO AGREGADO</p>
        <strong>Tu carrito ya está actualizado.</strong>
      </div>
      <button
        aria-label="Cerrar confirmación"
        onClick={() => setIsVisible(false)}
        type="button"
      >
        ×
      </button>
    </section>
  );
}
