"use client";

import Link from "next/link";
import { useState } from "react";

import styles from "./guest-cart-button.module.css";

export type GuestCartItem = {
  brand: string | null;
  imageUrl: string | null;
  name: string;
  productId: string;
  quantity: number;
  sku: string;
  slug: string;
};

export const guestCartStorageKey = "janvier:guest-cart:v1";
export const guestCartUpdatedEvent = "janvier:guest-cart-updated";

function readCart(): GuestCartItem[] {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(guestCartStorageKey) ?? "[]"
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GuestCartItem =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.productId === "string" &&
        typeof item.name === "string" &&
        typeof item.slug === "string" &&
        typeof item.sku === "string" &&
        typeof item.quantity === "number"
    );
  } catch {
    return [];
  }
}

export function getGuestCartQuantity(): number {
  return readCart().reduce((total, item) => total + item.quantity, 0);
}

export function notifyGuestCartUpdated() {
  window.dispatchEvent(new Event(guestCartUpdatedEvent));
}

export function GuestCartButton({ item }: { item: Omit<GuestCartItem, "quantity"> }) {
  const [added, setAdded] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  function addToCart() {
    const cart = readCart();
    const match = cart.find((entry) => entry.productId === item.productId);
    const next = match
      ? cart.map((entry) =>
          entry.productId === item.productId
            ? { ...entry, quantity: Math.min(999, entry.quantity + 1) }
            : entry
        )
      : [...cart, { ...item, quantity: 1 }];
    window.localStorage.setItem(guestCartStorageKey, JSON.stringify(next));
    notifyGuestCartUpdated();
    setAdded(true);
    setShowConfirmation(true);
  }

  return (
    <>
      <button className={styles.button} onClick={addToCart} type="button">
        {added ? "AGREGAR OTRA PIEZA" : "AGREGAR AL CARRITO"}
      </button>
      {showConfirmation ? (
        <section aria-live="polite" className={styles.confirmation} role="status">
          <div>
            <p>PRODUCTO AGREGADO</p>
            <strong>Ya está en tu carrito.</strong>
          </div>
          <Link href="/suministro/carrito">VER CARRITO</Link>
          <button
            aria-label="Cerrar confirmación"
            onClick={() => setShowConfirmation(false)}
            type="button"
          >
            ×
          </button>
        </section>
      ) : null}
    </>
  );
}
