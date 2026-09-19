"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./customer-logout-button.module.css";

export function CustomerLogoutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setError("");
    setIsPending(true);
    try {
      const response = await fetch("/api/customer/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout-failed");
      router.replace("/suministro/acceso");
      router.refresh();
    } catch {
      setError("NO FUE POSIBLE CERRAR LA SESIÓN. INTENTA DE NUEVO.");
      setIsPending(false);
    }
  }

  return (
    <div className={styles.control}>
      <button disabled={isPending} onClick={signOut} type="button">
        {isPending ? "CERRANDO SESIÓN…" : "CERRAR SESIÓN"}
      </button>
      {error ? <p aria-live="polite">{error}</p> : null}
    </div>
  );
}
