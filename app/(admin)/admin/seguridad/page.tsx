import { ChangePasswordForm } from "@/components/admin/change-password-form";

import styles from "./page.module.css";

export const metadata = { title: "Seguridad" };

export default function AdminSecurityPage() {
  return (
    <section className={styles.page}>
      <p>SECURITY / ADMIN_ACCOUNT</p>
      <h1>Protege el acceso administrativo.</h1>
      <div className={styles.copy}>
        <p>
          Usa una contraseña única de al menos 12 caracteres. Al actualizarla, todas las
          sesiones activas se cierran y JANVIER registra una alerta de seguridad.
        </p>
      </div>
      <ChangePasswordForm />
    </section>
  );
}
