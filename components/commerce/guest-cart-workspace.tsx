"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type GuestCartItem,
  guestCartStorageKey,
  guestCartUpdatedEvent,
  notifyGuestCartUpdated
} from "./guest-cart-button";
import styles from "./guest-cart-workspace.module.css";

function loadCart() {
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(guestCartStorageKey) ?? "[]"
    );
    return Array.isArray(value) ? (value as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

export function GuestCartWorkspace() {
  const [items, setItems] = useState<GuestCartItem[]>([]);
  const [email, setEmail] = useState("");

  useEffect(() => {
    function refresh() {
      setItems(loadCart());
      setEmail(window.localStorage.getItem("janvier:guest-cart-email:v1") ?? "");
    }
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(guestCartUpdatedEvent, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(guestCartUpdatedEvent, refresh);
    };
  }, []);

  function save(next: GuestCartItem[]) {
    setItems(next);
    window.localStorage.setItem(guestCartStorageKey, JSON.stringify(next));
    notifyGuestCartUpdated();
  }

  return (
    <section className={styles.workspace}>
      <header>
        <p>CARRITO TEMPORAL</p>
        <h1>Tu selección de productos.</h1>
        <span>
          Tu selección se conserva en este navegador. Al solicitar una cuenta podrás
          mantener tu carrito, ver tus condiciones y pedir una cotización.
        </span>
      </header>
      {items.length ? (
        <div className={styles.content}>
          <div className={styles.items}>
            {items.map((item) => (
              <article key={item.productId}>
                {item.imageUrl ? (
                  // El origen puede ser un derivado remoto; la ficha ya lo optimiza.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={item.imageUrl} />
                ) : (
                  <div />
                )}
                <section>
                  <small>{item.brand ?? "JANVIER"}</small>
                  <h2>{item.name}</h2>
                  <p>SKU {item.sku}</p>
                </section>
                <div className={styles.quantity}>
                  <button
                    aria-label={`Restar ${item.name}`}
                    onClick={() =>
                      save(
                        item.quantity === 1
                          ? items.filter((entry) => entry.productId !== item.productId)
                          : items.map((entry) =>
                              entry.productId === item.productId
                                ? { ...entry, quantity: entry.quantity - 1 }
                                : entry
                            )
                      )
                    }
                    type="button"
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    aria-label={`Sumar ${item.name}`}
                    onClick={() =>
                      save(
                        items.map((entry) =>
                          entry.productId === item.productId
                            ? { ...entry, quantity: Math.min(999, entry.quantity + 1) }
                            : entry
                        )
                      )
                    }
                    type="button"
                  >
                    +
                  </button>
                </div>
                <Link href={`/suministro/catalogo/${item.slug}`}>VER PRODUCTO</Link>
              </article>
            ))}
          </div>
          <aside>
            <p>GUARDA TU CARRITO</p>
            <h2>Crea una cuenta o inicia sesión.</h2>
            <label>
              <span>CORREO ELECTRÓNICO</span>
              <input
                autoComplete="email"
                onChange={(event) => {
                  const next = event.target.value;
                  setEmail(next);
                  window.localStorage.setItem("janvier:guest-cart-email:v1", next);
                }}
                placeholder="nombre@correo.com"
                type="email"
                value={email}
              />
            </label>
            <Link
              href={`/suministro/registro${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            >
              SOLICITAR UNA CUENTA
            </Link>
            <Link className={styles.secondary} href="/suministro/acceso">
              YA TENGO CUENTA
            </Link>
          </aside>
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>Aún no agregas productos.</h2>
          <Link href="/suministro/catalogo">EXPLORAR CATÁLOGO</Link>
        </section>
      )}
    </section>
  );
}
