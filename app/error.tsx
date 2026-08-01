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
      <h1 id="error-title">Algo no respondió como debía.</h1>
      <p className="systemPageCopy">
        Puedes intentar cargar esta sección de nuevo. El problema quedó aislado de la
        navegación principal.
      </p>
      <button type="button" onClick={reset}>
        Intentar de nuevo
      </button>
    </main>
  );
}
