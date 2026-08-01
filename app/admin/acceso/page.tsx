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
        <p>JANVIER / CONTROL_ROOM</p>
        <h1>Acceso administrativo.</h1>
        <span>PROJECTS / PROPOSALS / CLIENTS</span>
      </div>
      <AdminLoginForm />
      <Link href="/">Volver a JANVIER</Link>
    </main>
  );
}
