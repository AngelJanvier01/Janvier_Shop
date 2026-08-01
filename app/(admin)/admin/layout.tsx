import Link from "next/link";
import type { ReactNode } from "react";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";

import styles from "./layout.module.css";

export default async function AdminLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const admin = await requireCurrentAdmin();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/admin">JANVIER / CONTROL_ROOM</Link>
        <nav aria-label="Navegación administrativa">
          <Link href="/admin">Resumen</Link>
          <Link href="/admin/propuestas">Propuestas</Link>
          <Link href="/admin/proyectos">Proyectos</Link>
          <Link href="/admin/catalogo">Catalogo</Link>
          <span>{admin.email}</span>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
