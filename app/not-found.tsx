import Link from "next/link";

export default function NotFound() {
  return (
    <main className="systemPage" aria-labelledby="not-found-title">
      <p className="systemPageEyebrow">JANVIER / 404</p>
      <h1 id="not-found-title">Esta ruta no existe.</h1>
      <p className="systemPageCopy">
        Puedes volver al inicio o explorar las capacidades de JANVIER.
      </p>
      <Link href="/">Volver al inicio</Link>
    </main>
  );
}
