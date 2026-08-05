import Link from "next/link";
import type { ReactNode } from "react";

import { ThemePreferenceNotice } from "@/components/admin/theme-preference-notice";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { requireCurrentAdmin } from "@/lib/auth/current-admin";

import styles from "./layout.module.css";

const navigation = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/diagnosticos", label: "Diagnósticos" },
  { href: "/admin/analitica", label: "Analítica" },
  { href: "/admin/propuestas", label: "Propuestas" },
  { href: "/admin/proyectos", label: "Proyectos" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/ajustes/correo", label: "Ajustes" },
  { href: "/admin/seguridad", label: "Seguridad" }
];

export default async function AdminLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  const admin = await requireCurrentAdmin();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/">JANVIER / CONTROL_ROOM</Link>
        <div className={styles.headerControls}>
          <nav
            aria-label="Navegación administrativa"
            className={styles.desktopNavigation}
          >
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <span>{admin.email}</span>
          </nav>
          <ThemeToggle />
          <details className={styles.mobileNavigation}>
            <summary>MENÚ / ADMIN</summary>
            <nav aria-label="Navegación administrativa móvil">
              {navigation.map((item) => (
                <Link href={item.href} key={item.href}>
                  {item.label}
                </Link>
              ))}
              <span>{admin.email}</span>
            </nav>
          </details>
        </div>
      </header>
      <ThemePreferenceNotice />
      <main>{children}</main>
    </div>
  );
}
