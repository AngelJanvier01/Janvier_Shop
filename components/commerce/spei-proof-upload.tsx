"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./spei-proof-upload.module.css";

export function SpeiProofUpload({ quoteReference }: { quoteReference: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        const response = await fetch(
          `/api/commerce/spei-quotes/${encodeURIComponent(quoteReference)}/proof`,
          { body: new FormData(event.currentTarget), method: "POST" }
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setPending(false);
        if (!response.ok) {
          setMessage(data?.error ?? "No fue posible guardar el comprobante.");
          return;
        }
        event.currentTarget.reset();
        setMessage("COMPROBANTE ADJUNTADO PARA REVISIÓN.");
        router.refresh();
      }}
    >
      <label>
        <span>COMPROBANTE OPCIONAL / PDF, PNG O JPG · 10 MB MÁX.</span>
        <input
          accept="application/pdf,image/jpeg,image/png"
          name="proof"
          required
          type="file"
        />
      </label>
      <button disabled={pending} type="submit">
        {pending ? "ADJUNTANDO…" : "ADJUNTAR COMPROBANTE"}
      </button>
      {message ? <output>{message}</output> : null}
    </form>
  );
}
