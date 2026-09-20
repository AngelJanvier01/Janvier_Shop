"use client";

import { useState } from "react";

import styles from "./payment-copy-button.module.css";

export function PaymentCopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={styles.button}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      type="button"
    >
      {copied ? "COPIADO" : label}
    </button>
  );
}
