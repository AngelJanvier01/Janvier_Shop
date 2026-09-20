"use client";

import { useEffect, useState } from "react";

import { getGuestCartQuantity, guestCartUpdatedEvent } from "./guest-cart-button";

export function GuestCartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function refresh() {
      setCount(getGuestCartQuantity());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(guestCartUpdatedEvent, refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(guestCartUpdatedEvent, refresh);
    };
  }, []);

  return <strong>{count}</strong>;
}
