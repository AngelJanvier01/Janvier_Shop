import Link from "next/link";

import { AdminLoginForm } from "@/components/admin/login-form";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Acceso administrativo"
};

export default function AdminAccessPage() {
  return (
    <main className={styles.main}>
      <div>
        <p>JANVIER / PANEL_ADMIN</p>
        <h1>Acceso administrativo.</h1>
        <span>PROYECTOS / PROPUESTAS / CLIENTES</span>
      </div>
      <AdminLoginForm />
      <Link href="/">Volver a JANVIER</Link>
    </main>
  );
}
