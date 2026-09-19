import Link from "next/link";

import { CustomerLoginForm } from "@/components/commerce/customer-login-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Acceso comercial"
};

export default function CustomerAccessPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section>
          <p>CLIENT_ACCESS / APPROVED_ACCOUNTS</p>
          <h1>Tu operación, en un solo lugar.</h1>
          <span>
            Consulta precios, cotizaciones y disponibilidad con las condiciones de tu
            cuenta comercial.
          </span>
        </section>
        <div className={styles.formArea}>
          <CustomerLoginForm />
          <p>
            ¿AÚN NO TIENES CUENTA?{" "}
            <Link href="/suministro/registro">SOLICITA ACCESO</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
