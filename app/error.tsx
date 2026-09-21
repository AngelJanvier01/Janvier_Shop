"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("JANVIER route error", error);
  }, [error]);

  return (
    <main className="systemPage" aria-labelledby="error-title">
      <p className="systemPageEyebrow">JANVIER / SYSTEM ERROR</p>
      <h1 id="error-title">No pudimos cargar esta sección.</h1>
      <p className="systemPageCopy">
        Intenta de nuevo. Si el problema continúa, vuelve al inicio y prueba más tarde.
      </p>
      <button type="button" onClick={reset}>
        Intentar de nuevo
      </button>
    </main>
  );
}
